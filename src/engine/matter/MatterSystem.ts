import * as THREE from "three";
import { FullScreenPass, makeMaterial } from "@/engine/core/FullScreenPass";
import { MATTER_FRAG, MATTER_VERT } from "@/engine/shaders/matter.glsl";
import { MAX_FIELDS, SIM_FRAG, SIM_VERT } from "@/engine/shaders/sim.glsl";
import { gradientToLUT, LUT_WIDTH } from "@/domain/color/gradient";
import type {
  EmitterObject,
  FieldObject,
  Gradient,
  MatterObject,
  OpticsConfig,
} from "@/domain/types";

const SHAPE_INDEX: Record<string, number> = {
  point: 0,
  sphere: 1,
  shell: 2,
  box: 3,
  ring: 4,
  disc: 5,
};
const FIELD_INDEX: Record<string, number> = {
  radial: 0,
  vortex: 1,
  attractor: 2,
  repulsor: 3,
  curl: 4,
  directional: 5,
};
const SPAWN_INDEX: Record<string, number> = { static: 0, burst: 1, continuous: 2 };
const KIND_INDEX: Record<string, number> = { particles: 0, soft: 1, cells: 2, blobs: 3 };
const SOURCE_INDEX: Record<string, number> = {
  brightness: 0,
  energy: 1,
  depth: 2,
  age: 3,
  velocity: 4,
  radius: 5,
  noise: 6,
};

export interface MatterFrameContext {
  dt: number;
  time: number;
  phase: number;
  loopDuration: number;
  emitter: EmitterObject | null;
  fields: FieldObject[];
  gradient: Gradient;
  optics: OpticsConfig;
  viewportHeight: number;
  pixelRatio: number;
  depthNear: number;
  depthFar: number;
}

function targetPair(size: number): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    count: 2,
  });
  rt.textures.forEach((t) => {
    t.generateMipmaps = false;
  });
  return rt;
}

/**
 * One GPU-simulated matter system: position/velocity live in float textures,
 * the CPU never reads them back.
 */
export class MatterSystem {
  readonly id: string;
  private texSize: number;
  private count: number;
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private pingIndex = 0;
  private simPass: FullScreenPass;
  private lutTexture: THREE.DataTexture;
  private lutKey = "";
  readonly points: THREE.Points;
  private pointsMaterial: THREE.ShaderMaterial;
  private needsInit = true;
  private disposed = false;

  constructor(matter: MatterObject) {
    this.id = matter.id;
    this.count = clampCount(matter.config.count);
    this.texSize = textureSizeFor(this.count);
    this.targets = [targetPair(this.texSize), targetPair(this.texSize)];

    const fieldVec = () => Array.from({ length: MAX_FIELDS }, () => new THREE.Vector4());
    this.simPass = new FullScreenPass(
      makeMaterial(SIM_VERT, SIM_FRAG, {
        uPosTex: { value: null },
        uVelTex: { value: null },
        uDt: { value: 1 / 60 },
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uLoopFreq: { value: 0.125 },
        uInit: { value: true },
        uTexSize: { value: this.texSize },
        uCount: { value: this.count },
        uEmitPos: { value: new THREE.Vector3() },
        uEmitShape: { value: 1 },
        uEmitRadius: { value: 3 },
        uEmitThickness: { value: 0.3 },
        uEmitSeed: { value: 1 },
        uEmitVel: { value: 0.3 },
        uEmitVelVar: { value: 0.5 },
        uEmitSpread: { value: 1 },
        uSpawnMode: { value: 2 },
        uDrag: { value: 0.96 },
        uLifetime: { value: 6 },
        uLifeVar: { value: 0.5 },
        uSeed: { value: 1 },
        uSeparation: { value: 0 },
        uMerge: { value: 0 },
        uClusterRadius: { value: 3 },
        uMutation: { value: 0 },
        uPairwise: { value: false },
        uFieldCount: { value: 0 },
        uFieldA: { value: fieldVec() },
        uFieldB: { value: fieldVec() },
        uFieldC: { value: fieldVec() },
        uFieldD: { value: fieldVec() },
        uFieldE: { value: fieldVec() },
      }),
    );

    this.lutTexture = new THREE.DataTexture(
      new Uint8Array(LUT_WIDTH * 4),
      LUT_WIDTH,
      1,
      THREE.RGBAFormat,
    );
    this.lutTexture.minFilter = THREE.LinearFilter;
    this.lutTexture.magFilter = THREE.LinearFilter;
    this.lutTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.lutTexture.needsUpdate = true;

    this.pointsMaterial = new THREE.ShaderMaterial({
      vertexShader: MATTER_VERT,
      fragmentShader: MATTER_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPosTex: { value: null },
        uVelTex: { value: null },
        uLut: { value: this.lutTexture },
        uTexSize: { value: this.texSize },
        uSize: { value: 2 },
        uSizeVar: { value: 0.5 },
        uOpacity: { value: 0.4 },
        uViewportHeight: { value: 800 },
        uPixelRatio: { value: 1 },
        uVelocityStretch: { value: 0 },
        uTime: { value: 0 },
        uDofEnabled: { value: true },
        uFocusDistance: { value: 9 },
        uAperture: { value: 0.4 },
        uBlurStrength: { value: 1 },
        uForeground: { value: 1 },
        uBackground: { value: 1 },
        uSource: { value: 1 },
        uInputMin: { value: 0 },
        uInputMax: { value: 1 },
        uInvert: { value: false },
        uMapOffset: { value: 0 },
        uClamp: { value: true },
        uDepthNear: { value: 1 },
        uDepthFar: { value: 30 },
        uRadiusScale: { value: 8 },
        uSoftness: { value: 0.8 },
        uGlow: { value: 1 },
        uEmission: { value: 1.2 },
        uKind: { value: 1 },
        uMerge: { value: 0.5 },
        uSurfaceNoise: { value: 0.3 },
      },
    });

    this.points = new THREE.Points(this.buildGeometry(), this.pointsMaterial);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
  }

  private buildGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const indices = new Float32Array(this.count);
    const positions = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) indices[i] = i;
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(indices, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return geometry;
  }

  /** Structural rebuild — only when particle count changes. */
  resize(count: number): void {
    const next = clampCount(count);
    if (next === this.count) return;
    this.count = next;
    const size = textureSizeFor(next);
    if (size !== this.texSize) {
      this.texSize = size;
      this.targets.forEach((t) => t.dispose());
      this.targets = [targetPair(size), targetPair(size)];
      this.simPass.material.uniforms["uTexSize"]!.value = size;
      this.pointsMaterial.uniforms["uTexSize"]!.value = size;
    }
    this.simPass.material.uniforms["uCount"]!.value = next;
    this.points.geometry.dispose();
    this.points.geometry = this.buildGeometry();
    this.needsInit = true;
  }

  reset(): void {
    this.needsInit = true;
  }

  get particleCount(): number {
    return this.count;
  }

  private updateLut(gradient: Gradient): void {
    const key = JSON.stringify({ i: gradient.interpolation, s: gradient.stops });
    if (key === this.lutKey) return;
    this.lutKey = key;
    this.lutTexture.image.data = gradientToLUT(gradient);
    this.lutTexture.needsUpdate = true;
  }

  step(
    renderer: THREE.WebGLRenderer,
    matter: MatterObject,
    ctx: MatterFrameContext,
  ): void {
    if (this.disposed) return;
    const cfg = matter.config;
    const u = this.simPass.material.uniforms;
    const read = this.targets[this.pingIndex]!;
    const write = this.targets[1 - this.pingIndex]!;

    u["uPosTex"]!.value = read.textures[0];
    u["uVelTex"]!.value = read.textures[1];
    u["uDt"]!.value = Math.min(ctx.dt, 1 / 20);
    u["uTime"]!.value = ctx.time;
    u["uPhase"]!.value = ctx.phase;
    u["uLoopFreq"]!.value = 1 / Math.max(ctx.loopDuration, 0.01);
    u["uInit"]!.value = this.needsInit;

    const emitter = ctx.emitter;
    const ep = emitter ? emitter.transform.position : matter.transform.position;
    (u["uEmitPos"]!.value as THREE.Vector3).set(ep.x, ep.y, ep.z);
    u["uEmitShape"]!.value = SHAPE_INDEX[emitter?.config.shape ?? "sphere"] ?? 1;
    u["uEmitRadius"]!.value = (emitter?.config.radius ?? 3) * (emitter?.transform.scale.x ?? 1);
    u["uEmitThickness"]!.value = emitter?.config.thickness ?? 0.3;
    u["uEmitSeed"]!.value = emitter?.config.seed ?? 1;
    u["uEmitVel"]!.value = emitter?.config.initialVelocity ?? 0.2;
    u["uEmitVelVar"]!.value = emitter?.config.velocityVariation ?? 0.5;
    u["uEmitSpread"]!.value = emitter?.config.spread ?? 1;
    u["uSpawnMode"]!.value = SPAWN_INDEX[emitter?.config.spawnMode ?? "continuous"] ?? 2;

    u["uDrag"]!.value = cfg.drag;
    u["uLifetime"]!.value = cfg.lifetime;
    u["uLifeVar"]!.value = cfg.lifetimeVariation;
    u["uSeed"]!.value = emitter?.config.seed ?? 7;
    const pairwise = (cfg.kind === "cells" || cfg.kind === "blobs") && this.count <= 256;
    u["uPairwise"]!.value = pairwise;
    u["uSeparation"]!.value = cfg.separation;
    u["uMerge"]!.value = cfg.merge;
    u["uClusterRadius"]!.value = cfg.clusterRadius;
    u["uMutation"]!.value = cfg.mutation;

    const fields = ctx.fields.slice(0, MAX_FIELDS);
    u["uFieldCount"]!.value = fields.length;
    const A = u["uFieldA"]!.value as THREE.Vector4[];
    const B = u["uFieldB"]!.value as THREE.Vector4[];
    const C = u["uFieldC"]!.value as THREE.Vector4[];
    const D = u["uFieldD"]!.value as THREE.Vector4[];
    const E = u["uFieldE"]!.value as THREE.Vector4[];
    fields.forEach((f, i) => {
      const c = f.config;
      const p = f.transform.position;
      A[i]!.set(p.x, p.y, p.z, FIELD_INDEX[c.kind] ?? 0);
      B[i]!.set(c.radius, c.strength, c.falloff, c.frequency);
      C[i]!.set(c.temporalSpeed, (c.seed % 1000) * 0.01, c.twist, c.noiseDistortion);
      D[i]!.set(c.pulse, c.direction.x, c.direction.y, c.direction.z);
      E[i]!.set(c.octaves, 0, 0, 0);
    });

    this.simPass.render(renderer, write);
    this.pingIndex = 1 - this.pingIndex;
    this.needsInit = false;

    // ---- render-side uniforms
    const pu = this.pointsMaterial.uniforms;
    pu["uPosTex"]!.value = write.textures[0];
    pu["uVelTex"]!.value = write.textures[1];
    pu["uSize"]!.value = cfg.size * 0.05 * matter.transform.scale.x;
    pu["uSizeVar"]!.value = cfg.sizeVariation;
    pu["uOpacity"]!.value = cfg.opacity;
    pu["uViewportHeight"]!.value = ctx.viewportHeight;
    pu["uPixelRatio"]!.value = ctx.pixelRatio;
    pu["uVelocityStretch"]!.value = cfg.velocityStretch;
    pu["uTime"]!.value = ctx.time;
    pu["uDofEnabled"]!.value = ctx.optics.dof.enabled;
    pu["uFocusDistance"]!.value = ctx.optics.dof.focusDistance;
    pu["uAperture"]!.value = ctx.optics.dof.aperture;
    pu["uBlurStrength"]!.value = ctx.optics.dof.blurStrength;
    pu["uForeground"]!.value = ctx.optics.dof.foreground;
    pu["uBackground"]!.value = ctx.optics.dof.background;
    pu["uSource"]!.value = SOURCE_INDEX[cfg.colorSource] ?? 1;
    pu["uInputMin"]!.value = cfg.inputMin;
    pu["uInputMax"]!.value = cfg.inputMax;
    pu["uInvert"]!.value = cfg.invertMapping;
    pu["uMapOffset"]!.value = cfg.mappingOffset;
    pu["uClamp"]!.value = cfg.clampMapping;
    pu["uDepthNear"]!.value = ctx.depthNear;
    pu["uDepthFar"]!.value = ctx.depthFar;
    pu["uRadiusScale"]!.value = Math.max(1, (ctx.emitter?.config.radius ?? 4) * 1.8);
    pu["uSoftness"]!.value = cfg.softness;
    pu["uGlow"]!.value = cfg.glow;
    pu["uEmission"]!.value = cfg.emission;
    pu["uKind"]!.value = KIND_INDEX[cfg.kind] ?? 0;
    pu["uMerge"]!.value = cfg.merge;
    pu["uSurfaceNoise"]!.value = cfg.surfaceNoise;
    this.updateLut(ctx.gradient);
    this.points.visible = matter.enabled;
  }

  dispose(): void {
    this.disposed = true;
    this.targets.forEach((t) => t.dispose());
    this.simPass.dispose();
    this.points.geometry.dispose();
    this.pointsMaterial.dispose();
    this.lutTexture.dispose();
  }
}

export function clampCount(count: number): number {
  return Math.max(1, Math.min(262144, Math.floor(count)));
}

export function textureSizeFor(count: number): number {
  let size = 8;
  while (size * size < count) size *= 2;
  return size;
}
