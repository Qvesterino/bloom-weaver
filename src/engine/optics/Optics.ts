import * as THREE from "three";
import { FullScreenPass, makeMaterial } from "@/engine/core/FullScreenPass";
import {
  BLUR_FRAG,
  BRIGHT_FRAG,
  COMPOSITE_FRAG,
  DIFFUSION_FRAG,
  FS_VERT,
  UPSAMPLE_FRAG,
} from "@/engine/shaders/post.glsl";
import { hexToRgb } from "@/domain/color/gradient";
import type { ColorEngineConfig, OpticsConfig } from "@/domain/types";

interface Level {
  a: THREE.WebGLRenderTarget;
  b: THREE.WebGLRenderTarget;
  width: number;
  height: number;
}

function hdrTarget(w: number, h: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

/**
 * Optics engine: bright pass -> multi-resolution bloom -> diffusion -> composite
 * (tone, chromatic aberration, grain, vignette). Render targets are pooled and
 * only reallocated when the internal resolution changes.
 */
export class Optics {
  scene!: THREE.WebGLRenderTarget;
  private diffusion!: Level;
  private levels: Level[] = [];
  private diffusedScene!: THREE.WebGLRenderTarget;
  private width = 1;
  private height = 1;
  private levelCount = 5;

  private brightPass: FullScreenPass;
  private blurPass: FullScreenPass;
  private upsamplePass: FullScreenPass;
  private diffusionPass: FullScreenPass;
  private compositePass: FullScreenPass;
  private copyPass: FullScreenPass;

  constructor(width: number, height: number) {
    this.brightPass = new FullScreenPass(
      makeMaterial(FS_VERT, BRIGHT_FRAG, {
        uScene: { value: null },
        uThreshold: { value: 0.2 },
        uSoftness: { value: 0.6 },
      }),
    );
    this.blurPass = new FullScreenPass(
      makeMaterial(FS_VERT, BLUR_FRAG, {
        uSource: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uRadius: { value: 1 },
      }),
    );
    this.upsamplePass = new FullScreenPass(
      makeMaterial(FS_VERT, UPSAMPLE_FRAG, {
        uSource: { value: null },
        uPrevious: { value: null },
        uWeight: { value: 1 },
      }),
    );
    this.diffusionPass = new FullScreenPass(
      makeMaterial(FS_VERT, DIFFUSION_FRAG, {
        uScene: { value: null },
        uBlurred: { value: null },
        uAmount: { value: 0.3 },
        uBrightnessInfluence: { value: 0.7 },
      }),
    );
    this.copyPass = new FullScreenPass(
      makeMaterial(FS_VERT, BLUR_FRAG, {
        uSource: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uDirection: { value: new THREE.Vector2(0, 0) },
        uRadius: { value: 0 },
      }),
    );
    this.compositePass = new FullScreenPass(
      makeMaterial(FS_VERT, COMPOSITE_FRAG, {
        uScene: { value: null },
        uBloom: { value: null },
        uBackground: { value: new THREE.Vector3() },
        uBackgroundAlpha: { value: 1 },
        uTransparent: { value: false },
        uBloomIntensity: { value: 1 },
        uBloomHaze: { value: 0.5 },
        uExposure: { value: 1 },
        uContrast: { value: 1 },
        uGamma: { value: 1 },
        uSaturation: { value: 1 },
        uHighlights: { value: 1 },
        uBlacks: { value: 0 },
        uChromaEnabled: { value: true },
        uChromaAmount: { value: 0.1 },
        uChromaFalloff: { value: 1.5 },
        uGrainEnabled: { value: true },
        uGrainAmount: { value: 0.05 },
        uGrainScale: { value: 1 },
        uGrainSpeed: { value: 1 },
        uGrainMono: { value: true },
        uVignetteEnabled: { value: true },
        uVignetteAmount: { value: 0.4 },
        uVignetteSoftness: { value: 0.6 },
        uVignetteRoundness: { value: 1 },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
      }),
    );
    this.allocate(width, height, 5);
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  allocate(width: number, height: number, levelCount: number): void {
    const w = Math.max(2, Math.floor(width));
    const h = Math.max(2, Math.floor(height));
    if (w === this.width && h === this.height && levelCount === this.levelCount) return;
    this.disposeTargets();
    this.width = w;
    this.height = h;
    this.levelCount = levelCount;
    this.scene = hdrTarget(w, h);
    this.diffusedScene = hdrTarget(w, h);
    const dw = Math.max(2, w >> 2);
    const dh = Math.max(2, h >> 2);
    this.diffusion = { a: hdrTarget(dw, dh), b: hdrTarget(dw, dh), width: dw, height: dh };
    this.levels = [];
    for (let i = 0; i < levelCount; i++) {
      const lw = Math.max(2, w >> (i + 1));
      const lh = Math.max(2, h >> (i + 1));
      this.levels.push({ a: hdrTarget(lw, lh), b: hdrTarget(lw, lh), width: lw, height: lh });
    }
  }

  private blur(
    renderer: THREE.WebGLRenderer,
    source: THREE.Texture,
    level: Level,
    radius: number,
  ): void {
    const u = this.blurPass.material.uniforms;
    u["uSource"]!.value = source;
    (u["uTexel"]!.value as THREE.Vector2).set(1 / level.width, 1 / level.height);
    (u["uDirection"]!.value as THREE.Vector2).set(1, 0);
    u["uRadius"]!.value = radius;
    this.blurPass.render(renderer, level.b);
    u["uSource"]!.value = level.b.texture;
    (u["uDirection"]!.value as THREE.Vector2).set(0, 1);
    this.blurPass.render(renderer, level.a);
  }

  render(
    renderer: THREE.WebGLRenderer,
    optics: OpticsConfig,
    color: ColorEngineConfig,
    time: number,
    target: THREE.WebGLRenderTarget | null,
    transparent: boolean,
  ): void {
    let sceneTex = this.scene.texture;

    // ---- diffusion (soft atmospheric bloom of the whole image, detail preserving)
    if (optics.diffusion.amount > 0.001) {
      this.blur(renderer, sceneTex, this.diffusion, optics.diffusion.radius * 2.2);
      const du = this.diffusionPass.material.uniforms;
      du["uScene"]!.value = sceneTex;
      du["uBlurred"]!.value = this.diffusion.a.texture;
      du["uAmount"]!.value = optics.diffusion.amount;
      du["uBrightnessInfluence"]!.value = optics.diffusion.brightnessInfluence;
      this.diffusionPass.render(renderer, this.diffusedScene);
      sceneTex = this.diffusedScene.texture;
    }

    // ---- bloom
    let bloomTex: THREE.Texture | null = null;
    if (optics.bloom.enabled && this.levels.length > 0) {
      const bu = this.brightPass.material.uniforms;
      bu["uScene"]!.value = sceneTex;
      bu["uThreshold"]!.value = optics.bloom.threshold;
      bu["uSoftness"]!.value = optics.bloom.softness;
      const first = this.levels[0]!;
      this.brightPass.render(renderer, first.b);
      this.blur(renderer, first.b.texture, first, optics.bloom.radius);
      for (let i = 1; i < this.levels.length; i++) {
        this.blur(renderer, this.levels[i - 1]!.a.texture, this.levels[i]!, optics.bloom.radius);
      }
      let acc: THREE.Texture = this.levels[this.levels.length - 1]!.a.texture;
      for (let i = this.levels.length - 2; i >= 0; i--) {
        const level = this.levels[i]!;
        const uu = this.upsamplePass.material.uniforms;
        uu["uSource"]!.value = level.a.texture;
        uu["uPrevious"]!.value = acc;
        uu["uWeight"]!.value = optics.bloom.spread;
        this.upsamplePass.render(renderer, level.b);
        acc = level.b.texture;
      }
      bloomTex = acc;
    }

    const cu = this.compositePass.material.uniforms;
    cu["uScene"]!.value = sceneTex;
    cu["uBloom"]!.value = bloomTex ?? blackTexture();
    const bg = hexToRgb(color.roles.background.color);
    (cu["uBackground"]!.value as THREE.Vector3).set(bg[0], bg[1], bg[2]);
    cu["uBackgroundAlpha"]!.value = transparent ? 0 : color.roles.background.opacity;
    cu["uTransparent"]!.value = transparent;
    cu["uBloomIntensity"]!.value = optics.bloom.enabled ? optics.bloom.intensity : 0;
    cu["uBloomHaze"]!.value = optics.bloom.enabled ? optics.bloom.haze : 0;
    cu["uExposure"]!.value = optics.tone.exposure;
    cu["uContrast"]!.value = optics.tone.contrast;
    cu["uGamma"]!.value = optics.tone.gamma;
    cu["uSaturation"]!.value = optics.tone.saturation;
    cu["uHighlights"]!.value = optics.tone.highlights;
    cu["uBlacks"]!.value = optics.tone.blacks;
    cu["uChromaEnabled"]!.value = optics.chromatic.enabled;
    cu["uChromaAmount"]!.value = optics.chromatic.amount;
    cu["uChromaFalloff"]!.value = optics.chromatic.falloff;
    cu["uGrainEnabled"]!.value = optics.grain.enabled;
    cu["uGrainAmount"]!.value = optics.grain.amount;
    cu["uGrainScale"]!.value = optics.grain.scale;
    cu["uGrainSpeed"]!.value = optics.grain.speed;
    cu["uGrainMono"]!.value = optics.grain.mono;
    cu["uVignetteEnabled"]!.value = optics.vignette.enabled;
    cu["uVignetteAmount"]!.value = optics.vignette.amount;
    cu["uVignetteSoftness"]!.value = optics.vignette.softness;
    cu["uVignetteRoundness"]!.value = optics.vignette.roundness;
    cu["uTime"]!.value = time;
    (cu["uResolution"]!.value as THREE.Vector2).set(this.width, this.height);
    this.compositePass.render(renderer, target);
  }

  private disposeTargets(): void {
    this.scene?.dispose();
    this.diffusedScene?.dispose();
    if (this.diffusion) {
      this.diffusion.a.dispose();
      this.diffusion.b.dispose();
    }
    this.levels.forEach((l) => {
      l.a.dispose();
      l.b.dispose();
    });
    this.levels = [];
  }

  dispose(): void {
    this.disposeTargets();
    this.brightPass.dispose();
    this.blurPass.dispose();
    this.upsamplePass.dispose();
    this.diffusionPass.dispose();
    this.compositePass.dispose();
    this.copyPass.dispose();
  }
}

let blackTex: THREE.DataTexture | null = null;
function blackTexture(): THREE.Texture {
  if (!blackTex) {
    blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    blackTex.needsUpdate = true;
  }
  return blackTex;
}
