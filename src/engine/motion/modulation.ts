import type { Modulation, Project } from "@/domain/types";
import { getIn, setIn } from "@/state/store";

/** Smooth value noise so noise modulation never jitters. */
function smoothNoise(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed) * 127.1) * 43758.5453123;
    return s - Math.floor(s);
  };
  const a = h(i);
  const b = h(i + 1);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

/** All modulation is derived from normalized loop phase so cycles stay seamless. */
export function evaluateModulation(mod: Modulation, phase01: number, seedOffset = 0): number {
  const cycles = Math.max(1, Math.round(mod.frequency));
  const p = (phase01 * cycles + mod.phase) % 1;
  let wave: number;
  switch (mod.source) {
    case "sine":
      wave = Math.sin(p * Math.PI * 2);
      break;
    case "triangle":
      wave = 4 * Math.abs(p - 0.5) - 1;
      break;
    case "pulse":
      wave = p < 0.5 ? 1 : -1;
      break;
    default: {
      // periodic smooth noise: wrap the sample ring so the loop closes
      const n1 = smoothNoise(p * 8, seedOffset);
      const n2 = smoothNoise((p + 1) * 8, seedOffset);
      wave = (n1 * (1 - p) + n2 * p) * 2 - 1;
      break;
    }
  }
  return wave * mod.amount + mod.offset;
}

/**
 * Produce a per-frame resolved project with modulations applied.
 * The stored project is never mutated, so modulation never pollutes undo history.
 */
export function resolveProject(project: Project, phase01: number): Project {
  const keys = Object.keys(project.modulations);
  if (keys.length === 0) return project;
  let resolved = project;
  keys.forEach((key, index) => {
    const mod = project.modulations[key]!;
    const path = modulationPath(key, project);
    if (!path) return;
    const base = getIn(resolved, path);
    if (typeof base !== "number") return;
    resolved = setIn(resolved, path, base + evaluateModulation(mod, phase01, index * 13.7));
  });
  return resolved;
}

/** Modulation keys are either "objects/<id>/<config path>" or a direct project path. */
export function modulationPath(key: string, project: Project): string | null {
  if (!key.startsWith("objects/")) return key;
  const [, id, ...rest] = key.split("/");
  const index = project.objects.findIndex((o) => o.id === id);
  if (index < 0) return null;
  return `objects.${index}.${rest.join(".")}`;
}

export const modulationKeyForObject = (id: string, path: string) => `objects/${id}/${path}`;
