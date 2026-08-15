import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MatterSystem, clampCount, type MatterFrameContext } from "@/engine/matter/MatterSystem";
import { Optics } from "@/engine/optics/Optics";
import { evaluateCameraMotion } from "@/engine/motion/cameraMotion";
import { resolveProject } from "@/engine/motion/modulation";
import type {
  CameraObject,
  EmitterObject,
  FieldObject,
  MatterObject,
  Project,
  QualityMode,
} from "@/domain/types";

export interface EngineStats {
  fps: number;
  frameTime: number;
  particles: number;
  cells: number;
  activeFields: number;
  drawCalls: number;
  renderScale: number;
  loopTime: number;
  /** GPU resource accounting straight from the renderer. */
  geometries: number;
  textures: number;
  programs: number;
  triangles: number;
  points: number;
}

export type ContextState = "created" | "lost" | "restored" | "failed";

const QUALITY_SCALE: Record<QualityMode, number> = {
  draft: 0.6,
  interactive: 1,
  quality: 1,
};
const QUALITY_LEVELS: Record<QualityMode, number> = { draft: 3, interactive: 5, quality: 5 };
const QUALITY_DPR: Record<QualityMode, number> = { draft: 1, interactive: 1.5, quality: 2 };
const DRAFT_PARTICLE_SCALE = 0.4;
/** Live-preview budget. Exports use the authored counts. */
const LIVE_PARTICLE_CAP = 65536;

export interface EngineCallbacks {
  onStats?: (stats: EngineStats) => void;
  onLoopTime?: (t: number) => void;
  onCameraMoved?: (position: { x: number; y: number; z: number }) => void;
  onError?: (message: string) => void;
  onContextState?: (state: ContextState, message: string) => void;
}


/**
 * Renderer-owned runtime. Owns the animation loop, the GPU resources and every
 * per-frame decision. React only pushes declarative project state in.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly optics: Optics;
  private readonly systems = new Map<string, MatterSystem>();
  private readonly helpers = new THREE.Group();
  private readonly grid: THREE.GridHelper;

  private project: Project;
  private selectedId: string | null = null;
  private rafId = 0;
  private lastTime = 0;
  private loopTime = 0;
  private frames = 0;
  private fpsAccum = 0;
  private fps = 60;
  private frameTime = 0;
  private statsTimer = 0;
  private running = false;
  private exporting = false;
  private disposed = false;
  private baseCameraPos = new THREE.Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    project: Project,
    private callbacks: EngineCallbacks = {},
  ) {
    this.project = project;
    this.renderer = createRenderer(canvas);
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(0, 0, 9);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.6;
    this.controls.panSpeed = 0.7;
    this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener("end", () => {
      this.callbacks.onCameraMoved?.({
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      });
    });

    this.grid = new THREE.GridHelper(20, 20, 0x1b2733, 0x121a22);
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.4;
    this.grid.visible = false;
    this.scene.add(this.grid);
    this.scene.add(this.helpers);

    const size = this.canvasSize();
    this.optics = new Optics(size.width, size.height);
    this.syncSystems();
    this.applyCameraConfig(true);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.callbacks.onContextState?.("created", "WebGL2 context created");
  }

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.callbacks.onContextState?.("lost", "WebGL context lost — GPU released the drawing buffer");
    this.stop();
  };

  private onContextRestored = () => {
    this.callbacks.onContextState?.("restored", "WebGL context restored");
  };


  /* ------------------------------------------------------------------ state */

  setProject(project: Project): void {
    const prev = this.project;
    this.project = project;
    this.syncSystems();
    if (prev.viewport.quality !== project.viewport.quality) this.rebuildSystemCounts();
    this.grid.visible = project.viewport.showGrid;
    if (prev.objects.find((o) => o.type === "camera")?.id !== this.cameraObject()?.id) {
      this.applyCameraConfig(true);
    }
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
  }

  resetView(): void {
    const cam = this.cameraObject();
    this.controls.target.set(0, 0, 0);
    if (cam) this.camera.position.set(cam.transform.position.x, cam.transform.position.y, cam.transform.position.z);
    this.controls.update();
  }

  private cameraObject(): CameraObject | undefined {
    return this.project.objects.find((o): o is CameraObject => o.type === "camera");
  }

  private matterObjects(): MatterObject[] {
    return this.project.objects.filter((o): o is MatterObject => o.type === "matter");
  }

  private applyCameraConfig(hard = false): void {
    const cam = this.cameraObject();
    if (!cam) return;
    this.camera.fov = cam.config.fov;
    this.camera.near = cam.config.near;
    this.camera.far = cam.config.far;
    this.camera.updateProjectionMatrix();
    if (hard) {
      this.camera.position.set(
        cam.transform.position.x,
        cam.transform.position.y,
        cam.transform.position.z,
      );
      this.controls.update();
    }
  }

  /** Push an externally-edited camera position into the live view. */
  syncCameraPosition(): void {
    const cam = this.cameraObject();
    if (!cam) return;
    const p = cam.transform.position;
    if (this.camera.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) > 0.001) {
      this.camera.position.set(p.x, p.y, p.z);
      this.controls.update();
    }
  }

  private syncSystems(): void {
    const matter = this.matterObjects();
    const seen = new Set<string>();
    matter.forEach((m) => {
      seen.add(m.id);
      let system = this.systems.get(m.id);
      if (!system) {
        system = new MatterSystem(m);
        this.systems.set(m.id, system);
        this.scene.add(system.points);
      }
      const desired = this.effectiveCount(m.config.count);
      if (desired !== system.particleCount) system.resize(desired);
    });
    for (const [id, system] of this.systems) {
      if (!seen.has(id)) {
        this.scene.remove(system.points);
        system.dispose();
        this.systems.delete(id);
      }
    }
  }

  private effectiveCount(count: number): number {
    const scale =
      !this.exporting && this.project.viewport.quality === "draft" ? DRAFT_PARTICLE_SCALE : 1;
    const capped = this.exporting ? count : Math.min(count, LIVE_PARTICLE_CAP);
    return clampCount(Math.floor(capped * scale));
  }

  private rebuildSystemCounts(): void {
    this.matterObjects().forEach((m) => {
      const system = this.systems.get(m.id);
      if (system) system.resize(this.effectiveCount(m.config.count));
    });
  }

  resetSimulation(): void {
    this.systems.forEach((s) => s.reset());
    this.loopTime = 0;
  }

  /* ----------------------------------------------------------------- helpers */

  private updateHelpers(): void {
    this.helpers.clear();
    if (!this.project.viewport.showHelpers || !this.selectedId) return;
    const obj = this.project.objects.find((o) => o.id === this.selectedId);
    if (!obj || obj.type === "camera" || obj.type === "matter") return;
    const color = obj.type === "emitter" ? 0x4de3ff : 0xff6ad5;
    const radius =
      obj.type === "emitter" ? (obj as EmitterObject).config.radius : (obj as FieldObject).config.radius;
    const geo = new THREE.SphereGeometry(Math.max(0.05, radius), 24, 16);
    const mat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const p = obj.transform.position;
    mesh.position.set(p.x, p.y, p.z);
    this.helpers.add(mesh);
  }

  /* ------------------------------------------------------------------- frame */

  private canvasSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: Math.max(2, Math.floor(rect.width)),
      height: Math.max(2, Math.floor(rect.height)),
    };
  }

  private lastResizeKey = "";

  private resize(): void {
    const { width, height } = this.canvasSize();
    const quality = this.project.viewport.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, QUALITY_DPR[quality]);
    const internalScale = this.project.viewport.renderScale * QUALITY_SCALE[quality];
    const key = `${width}x${height}@${dpr}x${internalScale}:${quality}`;
    if (key === this.lastResizeKey) return;
    this.lastResizeKey = key;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.optics.allocate(
      Math.floor(width * dpr * internalScale),
      Math.floor(height * dpr * internalScale),
      QUALITY_LEVELS[quality],
    );
  }

  private frameContext(resolved: Project, dt: number, phase: number): Omit<MatterFrameContext, "emitter" | "fields" | "gradient"> {
    const cam = this.cameraObject();
    const size = this.optics.size;
    return {
      dt,
      time: this.loopTime,
      phase,
      loopDuration: resolved.loop.duration,
      optics: resolved.optics,
      viewportHeight: size.height,
      pixelRatio: 1,
      depthNear: Math.max(0.5, (cam?.config.near ?? 0.1) + 1),
      depthFar: Math.min(cam?.config.far ?? 60, this.camera.position.length() + 14),
    };
  }

  private stepAndRender(
    dt: number,
    target: THREE.WebGLRenderTarget | null,
    transparent = false,
  ): void {
    const duration = Math.max(0.1, this.project.loop.duration);
    const phase = this.project.loop.enabled ? (this.loopTime / duration) % 1 : this.loopTime / duration;
    const resolved = resolveProject(this.project, phase);

    // camera
    const cam = resolved.objects.find((o): o is CameraObject => o.type === "camera");
    if (cam) {
      this.camera.fov = cam.config.fov;
      this.camera.near = cam.config.near;
      this.camera.far = cam.config.far;
      this.baseCameraPos.copy(this.camera.position);
      const motion = evaluateCameraMotion(cam, phase);
      const dir = this.baseCameraPos.clone().sub(this.controls.target);
      dir.multiplyScalar(motion.distanceScale);
      this.camera.position.copy(this.controls.target).add(dir).add(motion.offset);
      this.camera.lookAt(this.controls.target);
      this.camera.rotateZ(motion.roll);
      this.camera.updateProjectionMatrix();
    }

    const base = this.frameContext(resolved, dt, phase);
    const emitters = resolved.objects.filter((o): o is EmitterObject => o.type === "emitter");
    const fields = resolved.objects.filter((o): o is FieldObject => o.type === "field");

    resolved.objects.forEach((obj) => {
      if (obj.type !== "matter") return;
      const system = this.systems.get(obj.id);
      if (!system) return;
      const emitter = emitters.find((e) => e.id === obj.config.emitterId && e.enabled) ?? null;
      const linked = obj.config.fieldIds
        .map((id) => fields.find((f) => f.id === id))
        .filter((f): f is FieldObject => !!f && f.enabled);
      system.step(this.renderer, obj, {
        ...base,
        emitter,
        fields: linked,
        gradient: gradientFor(resolved, obj),
      });
    });

    this.updateHelpers();

    this.renderer.setRenderTarget(this.optics.scene);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.optics.render(
      this.renderer,
      resolved.optics,
      resolved.color,
      this.loopTime,
      target,
      transparent,
    );

    // restore untouched camera position so the orbit controls stay authoritative
    this.camera.position.copy(this.baseCameraPos);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);
      if (this.exporting) return;
      if (document.hidden) {
        this.lastTime = now;
        return;
      }
      const raw = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(raw, 0.0005), 1 / 20);
      const start = performance.now();
      try {
        this.resize();
        this.controls.update();
        if (this.project.loop.playing) this.loopTime += dt * this.project.loop.rate;
        this.stepAndRender(this.project.loop.playing ? dt * this.project.loop.rate : 0, null);
      } catch (err) {
        this.callbacks.onError?.(err instanceof Error ? err.message : String(err));
        this.stop();
        return;
      }
      this.frameTime = performance.now() - start;
      this.frames += 1;
      this.fpsAccum += raw;
      this.statsTimer += raw;
      if (this.fpsAccum > 0.5) {
        this.fps = this.frames / this.fpsAccum;
        this.frames = 0;
        this.fpsAccum = 0;
      }
      if (this.statsTimer > 0.25) {
        this.statsTimer = 0;
        this.emitStats();
        this.callbacks.onLoopTime?.(this.loopTime);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private emitStats(): void {
    let particles = 0;
    let cells = 0;
    this.matterObjects().forEach((m) => {
      if (!m.enabled) return;
      const system = this.systems.get(m.id);
      const count = system?.particleCount ?? 0;
      if (m.config.kind === "cells" || m.config.kind === "blobs") cells += count;
      else particles += count;
    });
    const activeFields = new Set<string>();
    this.matterObjects().forEach((m) => {
      if (!m.enabled) return;
      m.config.fieldIds.forEach((id) => {
        const f = this.project.objects.find((o) => o.id === id);
        if (f?.enabled) activeFields.add(id);
      });
    });
    const info = this.renderer.info;
    this.callbacks.onStats?.({
      fps: this.fps,
      frameTime: this.frameTime,
      particles,
      cells,
      activeFields: activeFields.size,
      drawCalls: info.render.calls,
      renderScale: this.project.viewport.renderScale,
      loopTime: this.loopTime,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      triangles: info.render.triangles,
      points: info.render.points,
    });
  }


  /* ------------------------------------------------------------------ export */

  /**
   * Deterministic offline frame rendering: time is derived from the frame index,
   * never from wall clock, so exports are reproducible and loop seamlessly.
   */
  async renderSequence(
    width: number,
    height: number,
    fps: number,
    frameCount: number,
    onFrame: (pixels: Uint8Array, index: number) => Promise<void> | void,
    onProgress: (index: number, total: number) => void,
    shouldCancel: () => boolean,
    transparent: boolean,
  ): Promise<void> {
    this.exporting = true;
    const prevSize = new THREE.Vector2();
    this.renderer.getSize(prevSize);
    const prevPixelRatio = this.renderer.getPixelRatio();
    const prevLoopTime = this.loopTime;
    const prevAspect = this.camera.aspect;

    const target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });

    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.optics.allocate(width, height, 5);
      this.rebuildSystemCounts();

      const dt = 1 / fps;
      // warm-up so exported frames show an already-living scene
      this.resetSimulation();
      this.loopTime = 0;
      const warmup = Math.min(240, Math.round(fps * 2.5));
      for (let i = 0; i < warmup; i++) {
        this.loopTime += dt;
        this.stepAndRender(dt, target, transparent);
      }
      this.loopTime = 0;

      const buffer = new Uint8Array(width * height * 4);
      for (let frame = 0; frame < frameCount; frame++) {
        if (shouldCancel()) break;
        this.loopTime = frame * dt;
        this.stepAndRender(dt, target, transparent);
        this.renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
        await onFrame(buffer, frame);
        onProgress(frame + 1, frameCount);
        if (frame % 4 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      target.dispose();
      this.exporting = false;
      this.loopTime = prevLoopTime;
      this.renderer.setPixelRatio(prevPixelRatio);
      this.renderer.setSize(prevSize.x, prevSize.y, false);
      this.camera.aspect = prevAspect;
      this.camera.updateProjectionMatrix();
      this.rebuildSystemCounts();
      this.resetSimulation();
      this.lastResizeKey = "";
      this.resize();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.systems.forEach((s) => {
      this.scene.remove(s.points);
      s.dispose();
    });
    this.systems.clear();
    this.optics.dispose();
    this.controls.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.renderer.dispose();
    // release the GPU context immediately; otherwise repeated mounts exhaust the
    // browser's WebGL context budget and the whole tab grinds to a halt.
    this.renderer.forceContextLoss();
  }
}

function gradientFor(project: Project, matter: MatterObject) {
  const mode = project.color.mode;
  const maxIndex = mode === "single" ? 0 : mode === "dual" ? 1 : 2;
  const index = Math.min(matter.config.gradientIndex, maxIndex);
  return project.color.gradients[index] ?? project.color.gradients[0];
}

/**
 * Robust WebGL2 context creation. Some browsers/tabs refuse a context with the
 * preferred attributes (or have exhausted their context budget), so we retry
 * with progressively cheaper attributes instead of hard-crashing the app.
 */
function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const variants: THREE.WebGLRendererParameters[] = [
    { antialias: false, alpha: true, powerPreference: "high-performance" },
    { antialias: false, alpha: true, powerPreference: "default" },
    { antialias: false, alpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false },
  ];
  let lastError: unknown = null;
  for (const params of variants) {
    try {
      return new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: false, ...params });
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `WebGL2 is unavailable in this browser tab. Close other 3D tabs and reload. (${
      lastError instanceof Error ? lastError.message : String(lastError)
    })`,
  );
}
