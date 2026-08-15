import { uid, randomSeed } from "@/domain/id";
import type {
  CameraObject,
  EmitterObject,
  FieldKind,
  FieldObject,
  MatterKind,
  MatterObject,
  OpticsConfig,
  Transform,
  Vec3,
} from "@/domain/types";

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const identityTransform = (): Transform => ({
  position: v3(),
  rotation: v3(),
  scale: v3(1, 1, 1),
});

export function createCamera(overrides: Partial<CameraObject["config"]> = {}): CameraObject {
  return {
    id: uid("cam"),
    name: "Camera",
    type: "camera",
    enabled: true,
    transform: { ...identityTransform(), position: v3(0, 0, 9) },
    config: {
      fov: 45,
      near: 0.1,
      far: 200,
      focusDistance: 9,
      aperture: 0.35,
      motion: {
        type: "drift",
        speed: 0.25,
        radius: 9,
        elevation: 0.15,
        phase: 0,
        amount: 0.6,
        smoothness: 0.7,
      },
      ...overrides,
    },
  };
}

export function createEmitter(
  name = "Emitter",
  overrides: Partial<EmitterObject["config"]> = {},
): EmitterObject {
  return {
    id: uid("emit"),
    name,
    type: "emitter",
    enabled: true,
    transform: identityTransform(),
    config: {
      shape: "sphere",
      radius: 3,
      thickness: 0.3,
      density: 1,
      seed: randomSeed(),
      spawnMode: "continuous",
      initialVelocity: 0.3,
      velocityVariation: 0.5,
      spread: 1,
      ...overrides,
    },
  };
}

const MATTER_DEFAULTS: Record<MatterKind, Partial<MatterObject["config"]>> = {
  particles: { count: 32768, size: 1.2, softness: 0.5, glow: 0.8, opacity: 0.5 },
  soft: { count: 65536, size: 3.4, softness: 0.95, glow: 1.2, opacity: 0.22 },
  cells: { count: 64, size: 26, softness: 0.85, glow: 0.9, opacity: 0.6, drag: 0.9 },
  blobs: { count: 24, size: 48, softness: 1, glow: 1.4, opacity: 0.5, drag: 0.92 },
};

export function createMatter(
  kind: MatterKind,
  name: string,
  overrides: Partial<MatterObject["config"]> = {},
): MatterObject {
  return {
    id: uid("matter"),
    name,
    type: "matter",
    enabled: true,
    transform: identityTransform(),
    config: {
      kind,
      emitterId: null,
      fieldIds: [],
      count: 32768,
      size: 2,
      sizeVariation: 0.5,
      opacity: 0.35,
      softness: 0.8,
      glow: 1,
      emission: 1.2,
      drag: 0.96,
      lifetime: 6,
      lifetimeVariation: 0.5,
      velocityStretch: 0,
      separation: 0.3,
      merge: 0.5,
      mutation: 0.3,
      clusterRadius: 3,
      surfaceNoise: 0.3,
      gradientIndex: 0,
      colorSource: "energy",
      inputMin: 0,
      inputMax: 1,
      invertMapping: false,
      mappingOffset: 0,
      clampMapping: true,
      ...MATTER_DEFAULTS[kind],
      ...overrides,
    },
  };
}

const FIELD_DEFAULTS: Record<FieldKind, Partial<FieldObject["config"]>> = {
  radial: { strength: 1.4, radius: 4 },
  vortex: { strength: 1, radius: 5, twist: 0.4 },
  attractor: { strength: 1.2, radius: 6 },
  repulsor: { strength: 1, radius: 3 },
  curl: { strength: 0.9, frequency: 0.35, temporalSpeed: 0.25 },
  directional: { strength: 0.4, radius: 20 },
};

export function createField(
  kind: FieldKind,
  name: string,
  overrides: Partial<FieldObject["config"]> = {},
): FieldObject {
  return {
    id: uid("field"),
    name,
    type: "field",
    enabled: true,
    transform: identityTransform(),
    config: {
      kind,
      radius: 5,
      strength: 1,
      falloff: 1.5,
      frequency: 0.4,
      temporalSpeed: 0.2,
      seed: randomSeed(),
      twist: 0.3,
      noiseDistortion: 0.2,
      pulse: 0,
      octaves: 2,
      direction: v3(0, 1, 0),
      ...FIELD_DEFAULTS[kind],
      ...overrides,
    },
  };
}

export function defaultOptics(): OpticsConfig {
  return {
    bloom: {
      enabled: true,
      intensity: 1.1,
      threshold: 0.18,
      radius: 1,
      softness: 0.7,
      spread: 1,
      haze: 0.6,
    },
    dof: {
      enabled: true,
      focusDistance: 9,
      aperture: 0.4,
      blurStrength: 1,
      foreground: 1,
      background: 1,
    },
    tone: {
      exposure: 1,
      contrast: 1.05,
      gamma: 1,
      saturation: 1.05,
      highlights: 1,
      blacks: 0,
    },
    chromatic: { enabled: true, amount: 0.12, falloff: 1.6 },
    grain: { enabled: true, amount: 0.06, scale: 1.2, speed: 1, mono: true },
    vignette: { enabled: true, amount: 0.4, softness: 0.6, roundness: 1 },
    diffusion: { amount: 0.25, radius: 1.2, brightnessInfluence: 0.7 },
  };
}
