import { uid, randomSeed } from "@/domain/id";
import { PALETTES, paletteGradients } from "@/domain/color/palettes";
import {
  createCamera,
  createEmitter,
  createField,
  createMatter,
  defaultOptics,
  v3,
} from "@/domain/scene/factories";
import type {
  ColorEngineConfig,
  ColorMode,
  Project,
  SceneObject,
  ViewportConfig,
} from "@/domain/types";

export type RecipeId = "empty" | "nebula" | "anemone" | "petri" | "spore" | "plasma" | "aurora" | "void";

export interface RecipeMeta {
  id: RecipeId;
  name: string;
  description: string;
}

export const RECIPES: RecipeMeta[] = [
  { id: "nebula", name: "Nebula", description: "Layered luminous particle cloud with slow drift" },
  { id: "anemone", name: "Anemone", description: "Radial glowing organism with curl tendrils" },
  { id: "petri", name: "Petri", description: "Soft clustered cells under a microscope" },
  { id: "spore", name: "Spore", description: "Floating particulate biological field" },
  { id: "plasma", name: "Plasma", description: "Dense vortex-driven plasma body" },
  { id: "aurora", name: "Aurora", description: "Directional curtains of drifting light" },
  { id: "void", name: "Void", description: "Sparse cold dust in deep space" },
  { id: "empty", name: "Empty Scene", description: "Camera only — build from scratch" },
];

function colorEngine(paletteId: string, mode: ColorMode): ColorEngineConfig {
  const preset = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]!;
  const gradients = paletteGradients(preset);
  const role = (color: string, opacity = 1, emission = 1) => ({ color, opacity, emission });
  return {
    mode,
    gradients,
    roles: {
      background: role(preset.background, 1, 0),
      core: role(preset.gradients[0][preset.gradients[0].length - 1] ?? "#ffffff", 1, 1.6),
      matter: role(preset.gradients[0][1] ?? "#88ccff", 1, 1),
      highlights: role("#ffffff", 0.8, 1.2),
      glow: role(preset.gradients[1][1] ?? "#4488ff", 0.9, 1.4),
      haze: role(preset.gradients[2][1] ?? "#123344", 0.5, 0.6),
      accent: role(preset.gradients[0][2] ?? "#ffd0cf", 1, 1),
    },
  };
}

const viewport = (): ViewportConfig => ({
  showGrid: false,
  showHelpers: true,
  quality: "interactive",
  renderScale: 1,
  diagnostics: true,
});

function project(name: string, objects: SceneObject[], color: ColorEngineConfig): Project {
  return {
    id: uid("proj"),
    name,
    updatedAt: Date.now(),
    seed: randomSeed(),
    noiseSeed: randomSeed(),
    objects,
    color,
    optics: defaultOptics(),
    loop: { enabled: true, duration: 8, rate: 1, playing: true },
    viewport: viewport(),
    modulations: {},
  };
}

export function buildRecipe(id: RecipeId): Project {
  switch (id) {
    case "empty": {
      return project("Empty Scene", [createCamera({ motion: { type: "static", speed: 0.2, radius: 9, elevation: 0.1, phase: 0, amount: 0.5, smoothness: 0.7 } })], colorEngine("deep-space", "single"));
    }

    case "anemone": {
      const camera = createCamera({
        fov: 40,
        focusDistance: 8,
        aperture: 0.5,
        motion: { type: "pushIn", speed: 0.18, radius: 8, elevation: 0.1, phase: 0, amount: 1.2, smoothness: 0.8 },
      });
      const shell = createEmitter("Shell Emitter", {
        shape: "shell",
        radius: 0.8,
        thickness: 0.15,
        initialVelocity: 1.5,
        velocityVariation: 0.6,
        spread: 1,
      });
      const coreEmitter = createEmitter("Core Emitter", {
        shape: "sphere",
        radius: 0.5,
        initialVelocity: 0.05,
        spawnMode: "static",
      });
      const radial = createField("radial", "Radial Force", { strength: 2.6, radius: 6, falloff: 1.1, pulse: 0.4 });
      const curl = createField("curl", "Curl Field", { strength: 1.6, frequency: 0.5, temporalSpeed: 0.35 });
      const vortex = createField("vortex", "Weak Vortex", { strength: 0.35, radius: 6, twist: 0.5 });
      const tendrils = createMatter("soft", "Tendrils", {
        emitterId: shell.id,
        fieldIds: [radial.id, curl.id, vortex.id],
        count: 65536,
        size: 2.6,
        opacity: 0.24,
        glow: 1.4,
        emission: 1.8,
        drag: 0.975,
        lifetime: 4.5,
        velocityStretch: 0.5,
        gradientIndex: 1,
        colorSource: "radius",
        inputMax: 0.7,
      });
      const core = createMatter("blobs", "Core", {
        emitterId: coreEmitter.id,
        fieldIds: [curl.id],
        count: 12,
        size: 70,
        opacity: 0.55,
        glow: 1.8,
        emission: 2.4,
        gradientIndex: 0,
        colorSource: "brightness",
      });
      const optics = defaultOptics();
      optics.bloom.intensity = 1.9;
      optics.bloom.threshold = 0.12;
      optics.bloom.haze = 0.9;
      optics.dof.aperture = 0.55;
      const p = project("Anemone", [camera, shell, coreEmitter, tendrils, core, radial, curl, vortex], colorEngine("ultraviolet", "dual"));
      p.optics = optics;
      p.loop.duration = 8;
      return p;
    }

    case "petri": {
      const camera = createCamera({
        fov: 30,
        focusDistance: 10,
        aperture: 0.8,
        motion: { type: "drift", speed: 0.12, radius: 10, elevation: 0.05, phase: 0, amount: 0.25, smoothness: 0.9 },
      });
      camera.transform.position = v3(0, 0, 10);
      const emitter = createEmitter("Culture Emitter", {
        shape: "disc",
        radius: 4.2,
        thickness: 0.4,
        initialVelocity: 0.06,
        spawnMode: "static",
      });
      const curl = createField("curl", "Weak Curl", { strength: 0.28, frequency: 0.22, temporalSpeed: 0.12 });
      const repulse = createField("repulsor", "Separation", { strength: 0.35, radius: 4, falloff: 2 });
      const cells = createMatter("cells", "Cells", {
        emitterId: emitter.id,
        fieldIds: [curl.id, repulse.id],
        count: 72,
        size: 34,
        sizeVariation: 0.7,
        opacity: 0.65,
        softness: 0.9,
        glow: 1,
        emission: 1.3,
        drag: 0.94,
        lifetime: 20,
        clusterRadius: 3.6,
        separation: 0.6,
        merge: 0.6,
        mutation: 0.4,
        gradientIndex: 0,
        colorSource: "depth",
      });
      const dust = createMatter("soft", "Medium Dust", {
        emitterId: emitter.id,
        fieldIds: [curl.id],
        count: 16384,
        size: 1.6,
        opacity: 0.12,
        glow: 0.6,
        emission: 0.8,
        lifetime: 14,
        gradientIndex: 2,
        colorSource: "noise",
      });
      const optics = defaultOptics();
      optics.bloom.intensity = 0.9;
      optics.grain.amount = 0.14;
      optics.dof.aperture = 0.75;
      optics.vignette.amount = 0.6;
      const p = project("Petri", [camera, emitter, cells, dust, curl, repulse], colorEngine("petri", "dual"));
      p.optics = optics;
      p.loop.duration = 12;
      return p;
    }

    case "spore": {
      const camera = createCamera({
        fov: 50,
        focusDistance: 7,
        aperture: 0.6,
        motion: { type: "drift", speed: 0.2, radius: 9, elevation: 0.2, phase: 0, amount: 0.9, smoothness: 0.75 },
      });
      const clusterA = createEmitter("Cluster A", { shape: "sphere", radius: 1.6, initialVelocity: 0.15 });
      const clusterB = createEmitter("Cluster B", { shape: "sphere", radius: 2.4, initialVelocity: 0.2 });
      clusterA.transform.position = v3(-2.4, 0.6, 1);
      clusterB.transform.position = v3(2.6, -0.8, -1.5);
      const attractor = createField("attractor", "Attractor", { strength: 0.8, radius: 8, falloff: 1.2 });
      const curl = createField("curl", "Curl", { strength: 1.1, frequency: 0.42, temporalSpeed: 0.22 });
      const sporesA = createMatter("particles", "Spores A", {
        emitterId: clusterA.id,
        fieldIds: [attractor.id, curl.id],
        count: 32768,
        size: 1.1,
        opacity: 0.45,
        glow: 1.1,
        lifetime: 9,
        gradientIndex: 0,
        colorSource: "velocity",
      });
      const sporesB = createMatter("soft", "Spores B", {
        emitterId: clusterB.id,
        fieldIds: [attractor.id, curl.id],
        count: 32768,
        size: 3,
        opacity: 0.16,
        glow: 1.3,
        lifetime: 11,
        gradientIndex: 1,
        colorSource: "depth",
      });
      const optics = defaultOptics();
      optics.bloom.intensity = 1.4;
      optics.dof.aperture = 0.7;
      const p = project("Spore", [camera, clusterA, clusterB, sporesA, sporesB, attractor, curl], colorEngine("bioluminescent", "dual"));
      p.optics = optics;
      return p;
    }

    case "plasma": {
      const camera = createCamera({ fov: 45, motion: { type: "orbit", speed: 0.14, radius: 8, elevation: 0.2, phase: 0, amount: 1, smoothness: 0.8 } });
      const emitter = createEmitter("Plasma Emitter", { shape: "sphere", radius: 2.2, initialVelocity: 0.4 });
      const vortex = createField("vortex", "Vortex", { strength: 2.2, radius: 6, twist: 0.8, noiseDistortion: 0.4 });
      const curl = createField("curl", "Turbulence", { strength: 1.3, frequency: 0.6, temporalSpeed: 0.4 });
      const matter = createMatter("soft", "Plasma", {
        emitterId: emitter.id,
        fieldIds: [vortex.id, curl.id],
        count: 65536,
        size: 3.2,
        opacity: 0.2,
        glow: 1.5,
        emission: 2,
        gradientIndex: 0,
        colorSource: "velocity",
      });
      const p = project("Plasma", [camera, emitter, matter, vortex, curl], colorEngine("coral-fluorescence", "dual"));
      p.optics.bloom.intensity = 1.7;
      return p;
    }

    case "aurora": {
      const camera = createCamera({ fov: 55, motion: { type: "drift", speed: 0.1, radius: 10, elevation: 0.1, phase: 0, amount: 0.5, smoothness: 0.9 } });
      const emitter = createEmitter("Curtain Emitter", { shape: "box", radius: 6, initialVelocity: 0.1 });
      const dir = createField("directional", "Updraft", { strength: 0.6, radius: 30, direction: v3(0, 1, 0) });
      const curl = createField("curl", "Curl", { strength: 0.9, frequency: 0.18, temporalSpeed: 0.14 });
      const matter = createMatter("soft", "Curtains", {
        emitterId: emitter.id,
        fieldIds: [dir.id, curl.id],
        count: 65536,
        size: 3.6,
        opacity: 0.16,
        glow: 1.3,
        lifetime: 12,
        gradientIndex: 0,
        colorSource: "brightness",
      });
      const p = project("Aurora", [camera, emitter, matter, dir, curl], colorEngine("bioluminescent", "triple"));
      p.optics.bloom.haze = 1;
      return p;
    }

    case "void": {
      const camera = createCamera({ fov: 38, motion: { type: "noise", speed: 0.08, radius: 12, elevation: 0.1, phase: 0, amount: 0.4, smoothness: 0.95 } });
      const emitter = createEmitter("Dust Emitter", { shape: "sphere", radius: 9, initialVelocity: 0.02, spawnMode: "static" });
      const curl = createField("curl", "Slow Curl", { strength: 0.2, frequency: 0.1, temporalSpeed: 0.06 });
      const matter = createMatter("particles", "Dust", {
        emitterId: emitter.id,
        fieldIds: [curl.id],
        count: 16384,
        size: 0.8,
        opacity: 0.5,
        glow: 0.5,
        lifetime: 30,
        gradientIndex: 0,
        colorSource: "depth",
      });
      const p = project("Void", [camera, emitter, matter, curl], colorEngine("monochrome-ice", "single"));
      p.optics.bloom.intensity = 0.7;
      return p;
    }

    case "nebula":
    default: {
      const camera = createCamera({
        fov: 45,
        focusDistance: 9.5,
        aperture: 0.45,
        motion: { type: "drift", speed: 0.16, radius: 9, elevation: 0.18, phase: 0, amount: 0.8, smoothness: 0.85 },
      });
      const volume = createEmitter("Volume Emitter", {
        shape: "sphere",
        radius: 5.4,
        initialVelocity: 0.12,
        velocityVariation: 0.8,
      });
      const cores = createEmitter("Core Emitter", {
        shape: "shell",
        radius: 2.4,
        thickness: 0.6,
        initialVelocity: 0.1,
      });
      const curl = createField("curl", "Curl Turbulence", {
        strength: 1.05,
        frequency: 0.28,
        temporalSpeed: 0.18,
        octaves: 3,
      });
      const attractor = createField("attractor", "Soft Attractor", { strength: 0.35, radius: 9, falloff: 1.4 });
      const haze = createMatter("soft", "Haze Layer", {
        emitterId: volume.id,
        fieldIds: [curl.id, attractor.id],
        count: 65536,
        size: 4.2,
        opacity: 0.14,
        softness: 1,
        glow: 1.5,
        emission: 1.5,
        lifetime: 14,
        drag: 0.985,
        gradientIndex: 2,
        colorSource: "depth",
        inputMin: 0.1,
        inputMax: 0.95,
      });
      const cloud = createMatter("soft", "Main Cloud", {
        emitterId: volume.id,
        fieldIds: [curl.id, attractor.id],
        count: 65536,
        size: 2.4,
        opacity: 0.2,
        glow: 1.2,
        emission: 1.6,
        lifetime: 12,
        gradientIndex: 0,
        colorSource: "energy",
      });
      const sparks = createMatter("particles", "Bright Cores", {
        emitterId: cores.id,
        fieldIds: [curl.id],
        count: 8192,
        size: 0.9,
        opacity: 0.85,
        softness: 0.35,
        glow: 1.6,
        emission: 2.6,
        lifetime: 8,
        gradientIndex: 1,
        colorSource: "age",
      });
      const optics = defaultOptics();
      optics.bloom.intensity = 1.6;
      optics.bloom.haze = 0.85;
      optics.diffusion.amount = 0.35;
      const p = project(
        "Nebula",
        [camera, volume, cores, haze, cloud, sparks, curl, attractor],
        colorEngine("nebula-cyan", "triple"),
      );
      p.optics = optics;
      return p;
    }
  }
}

export const createDefaultProject = () => buildRecipe("nebula");
