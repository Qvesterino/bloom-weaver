/**
 * Matter Field — declarative domain model.
 * Nothing in this file references Three.js: it is pure serializable configuration.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export type SceneObjectType = "camera" | "emitter" | "matter" | "field";

export type EmitterShape = "point" | "sphere" | "shell" | "box" | "ring" | "disc";
export type SpawnMode = "static" | "burst" | "continuous";
export type MatterKind = "particles" | "soft" | "cells" | "blobs";
export type FieldKind =
  | "radial"
  | "vortex"
  | "attractor"
  | "repulsor"
  | "curl"
  | "directional";

export type ColorSource =
  | "brightness"
  | "energy"
  | "depth"
  | "age"
  | "velocity"
  | "radius"
  | "noise";

export type CameraMotionType =
  | "static"
  | "orbit"
  | "pushIn"
  | "pullOut"
  | "drift"
  | "roll"
  | "noise";

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  focusDistance: number;
  aperture: number;
  motion: {
    type: CameraMotionType;
    speed: number;
    radius: number;
    elevation: number;
    phase: number;
    amount: number;
    smoothness: number;
  };
}

export interface EmitterConfig {
  shape: EmitterShape;
  radius: number;
  thickness: number;
  density: number;
  seed: number;
  spawnMode: SpawnMode;
  initialVelocity: number;
  velocityVariation: number;
  spread: number;
}

export interface MatterConfig {
  kind: MatterKind;
  emitterId: string | null;
  fieldIds: string[];
  count: number;
  size: number;
  sizeVariation: number;
  opacity: number;
  softness: number;
  glow: number;
  emission: number;
  drag: number;
  lifetime: number;
  lifetimeVariation: number;
  velocityStretch: number;
  /** cells / blobs semantics */
  separation: number;
  merge: number;
  mutation: number;
  clusterRadius: number;
  surfaceNoise: number;
  /** color engine */
  gradientIndex: 0 | 1 | 2;
  colorSource: ColorSource;
  inputMin: number;
  inputMax: number;
  invertMapping: boolean;
  mappingOffset: number;
  clampMapping: boolean;
}

export interface FieldConfig {
  kind: FieldKind;
  radius: number;
  strength: number;
  falloff: number;
  frequency: number;
  temporalSpeed: number;
  seed: number;
  twist: number;
  noiseDistortion: number;
  pulse: number;
  octaves: number;
  direction: Vec3;
}

interface BaseObject {
  id: string;
  name: string;
  enabled: boolean;
  transform: Transform;
}

export interface CameraObject extends BaseObject {
  type: "camera";
  config: CameraConfig;
}
export interface EmitterObject extends BaseObject {
  type: "emitter";
  config: EmitterConfig;
}
export interface MatterObject extends BaseObject {
  type: "matter";
  config: MatterConfig;
}
export interface FieldObject extends BaseObject {
  type: "field";
  config: FieldConfig;
}

export type SceneObject = CameraObject | EmitterObject | MatterObject | FieldObject;

/* ------------------------------------------------------------------ color */

export type Interpolation = "oklch" | "rgb" | "hsl";

export interface GradientStop {
  id: string;
  position: number;
  color: string;
  opacity: number;
}

export interface Gradient {
  id: string;
  name: string;
  interpolation: Interpolation;
  stops: GradientStop[];
}

export type ColorMode = "single" | "dual" | "triple";

export interface ColorRole {
  color: string;
  opacity: number;
  emission: number;
}

export interface ColorEngineConfig {
  mode: ColorMode;
  gradients: [Gradient, Gradient, Gradient];
  roles: {
    background: ColorRole;
    core: ColorRole;
    matter: ColorRole;
    highlights: ColorRole;
    glow: ColorRole;
    haze: ColorRole;
    accent: ColorRole;
  };
}

/* ----------------------------------------------------------------- optics */

export interface OpticsConfig {
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    radius: number;
    softness: number;
    spread: number;
    haze: number;
  };
  dof: {
    enabled: boolean;
    focusDistance: number;
    aperture: number;
    blurStrength: number;
    foreground: number;
    background: number;
  };
  tone: {
    exposure: number;
    contrast: number;
    gamma: number;
    saturation: number;
    highlights: number;
    blacks: number;
  };
  chromatic: { enabled: boolean; amount: number; falloff: number };
  grain: { enabled: boolean; amount: number; scale: number; speed: number; mono: boolean };
  vignette: { enabled: boolean; amount: number; softness: number; roundness: number };
  diffusion: { amount: number; radius: number; brightnessInfluence: number };
}

/* ------------------------------------------------------------------ motion */

export type ModulationSource = "sine" | "triangle" | "noise" | "pulse";

export interface Modulation {
  source: ModulationSource;
  amount: number;
  frequency: number;
  phase: number;
  offset: number;
}

export interface LoopConfig {
  enabled: boolean;
  duration: number;
  rate: number;
  playing: boolean;
}

export type QualityMode = "draft" | "interactive" | "quality";

export interface ViewportConfig {
  showGrid: boolean;
  showHelpers: boolean;
  quality: QualityMode;
  renderScale: 0.5 | 0.75 | 1;
  diagnostics: boolean;
}

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  seed: number;
  noiseSeed: number;
  objects: SceneObject[];
  color: ColorEngineConfig;
  optics: OpticsConfig;
  loop: LoopConfig;
  viewport: ViewportConfig;
  /** keyed by "<objectId>.<config path>" or "optics.bloom.intensity" */
  modulations: Record<string, Modulation>;
}

export type ExportFormat = "still" | "png" | "gif" | "webm";

export interface ExportSettings {
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  /** seconds; 0 means "use the loop duration" */
  duration: number;
  bitrateMbps: number;
  transparent: boolean;
}

