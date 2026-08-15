import { create } from "zustand";
import { uid, randomSeed } from "@/domain/id";
import { buildRecipe, createDefaultProject, type RecipeId } from "@/domain/recipes";
import { persistence } from "@/persistence/db";
import type {
  Gradient,
  GradientStop,
  Modulation,
  Project,
  SceneObject,
  SceneObjectType,
} from "@/domain/types";
import { PALETTES, paletteGradients } from "@/domain/color/palettes";

type Plain = Record<string, unknown>;

/** Immutable deep set on a plain-object path, e.g. "optics.bloom.intensity". */
export function setIn<T>(root: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = (node: unknown, depth: number): unknown => {
    const key = keys[depth]!;
    const source = (node ?? {}) as Plain;
    const next = Array.isArray(source) ? [...(source as unknown[])] : { ...source };
    (next as Plain)[key] = depth === keys.length - 1 ? value : clone(source[key], depth + 1);
    return next;
  };
  return clone(root, 0) as T;
}

export function getIn(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc as Plain | undefined)?.[key], root);
}

const MAX_HISTORY = 100;

interface HistoryEntry {
  project: Project;
  label: string;
}

export type CommitMode = "push" | "coalesce" | "none";

interface EditorState {
  project: Project;
  selectedId: string | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  hydrated: boolean;
  rebuilding: boolean;
  loopTime: number;
  savedProjects: Project[];
  /* ---- lifecycle */
  hydrate: () => Promise<void>;
  newProject: (recipe: RecipeId) => void;
  loadRecipe: (recipe: RecipeId) => void;
  openProject: (id: string) => Promise<void>;
  duplicateProject: () => void;
  renameProject: (name: string) => void;
  save: () => Promise<void>;
  refreshProjectList: () => Promise<void>;
  /* ---- editing */
  select: (id: string | null) => void;
  commit: (mutate: (draft: Project) => Project, label: string, mode?: CommitMode) => void;
  setPath: (path: string, value: unknown, label?: string, mode?: CommitMode) => void;
  setObjectPath: (id: string, path: string, value: unknown, mode?: CommitMode) => void;
  addObject: (type: Exclude<SceneObjectType, "camera">, kind: string) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  renameObject: (id: string, name: string) => void;
  toggleObject: (id: string) => void;
  toggleMatterField: (matterId: string, fieldId: string) => void;
  /* ---- color */
  updateGradient: (index: number, updater: (g: Gradient) => Gradient, label: string, mode?: CommitMode) => void;
  applyPalette: (paletteId: string) => void;
  /* ---- modulation */
  setModulation: (key: string, mod: Modulation | null) => void;
  /* ---- history */
  undo: () => void;
  redo: () => void;
  setRebuilding: (v: boolean) => void;
  setLoopTime: (t: number) => void;
}

let coalesceKey = "";
let coalesceTime = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(get: () => EditorState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { project } = get();
    void persistence.saveProject(project);
    void persistence.saveRecovery(project);
  }, 900);
}

export const useEditor = create<EditorState>((set, get) => ({
  project: createDefaultProject(),
  selectedId: null,
  past: [],
  future: [],
  hydrated: false,
  rebuilding: false,
  loopTime: 0,
  savedProjects: [],

  hydrate: async () => {
    try {
      const lastId = await persistence.lastProjectId();
      const recovery = await persistence.loadRecovery();
      const stored = lastId ? await persistence.loadProject(lastId) : undefined;
      const chosen =
        recovery && stored && recovery.id === stored.id && recovery.updatedAt >= stored.updatedAt
          ? recovery
          : (stored ?? recovery);
      if (chosen) {
        set({ project: chosen, hydrated: true, past: [], future: [] });
      } else {
        const fresh = get().project;
        await persistence.saveProject(fresh);
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
    void get().refreshProjectList();
  },

  newProject: (recipe) => {
    const project = buildRecipe(recipe);
    set({ project, selectedId: null, past: [], future: [] });
    void persistence.saveProject(project);
    void get().refreshProjectList();
  },

  loadRecipe: (recipe) => {
    const next = buildRecipe(recipe);
    get().commit(() => next, `Load recipe: ${next.name}`);
  },

  openProject: async (id) => {
    const p = await persistence.loadProject(id);
    if (p) set({ project: p, selectedId: null, past: [], future: [] });
  },

  duplicateProject: () => {
    const p = get().project;
    const copy: Project = { ...structuredClone(p), id: uid("proj"), name: `${p.name} copy` };
    set({ project: copy, past: [], future: [] });
    void persistence.saveProject(copy);
    void get().refreshProjectList();
  },

  renameProject: (name) => get().setPath("name", name, "Rename project", "coalesce"),

  save: async () => {
    await persistence.saveProject(get().project);
    await get().refreshProjectList();
  },

  refreshProjectList: async () => {
    try {
      set({ savedProjects: await persistence.listProjects() });
    } catch {
      /* storage unavailable */
    }
  },

  select: (id) => set({ selectedId: id }),

  commit: (mutate, label, mode = "push") => {
    const state = get();
    const now = Date.now();
    let past = state.past;
    if (mode === "push") {
      past = [...state.past, { project: state.project, label }].slice(-MAX_HISTORY);
      coalesceKey = "";
    } else if (mode === "coalesce") {
      const sameRun = coalesceKey === label && now - coalesceTime < 700;
      if (!sameRun) past = [...state.past, { project: state.project, label }].slice(-MAX_HISTORY);
      coalesceKey = label;
      coalesceTime = now;
    }
    set({ project: mutate(state.project), past, future: mode === "none" ? state.future : [] });
    scheduleAutosave(get);
  },

  setPath: (path, value, label, mode = "coalesce") =>
    get().commit((p) => setIn(p, path, value), label ?? `Change ${path}`, mode),

  setObjectPath: (id, path, value, mode = "coalesce") =>
    get().commit(
      (p) => ({
        ...p,
        objects: p.objects.map((o) => (o.id === id ? (setIn(o, path, value) as SceneObject) : o)),
      }),
      `Change ${path}`,
      mode,
    ),

  addObject: (type, kind) => {
    get().commit((p) => ({ ...p, objects: [...p.objects, buildObject(type, kind)] }), `Add ${kind}`);
  },


  deleteObject: (id) =>
    get().commit((p) => {
      const target = p.objects.find((o) => o.id === id);
      if (!target || target.type === "camera") return p;
      return {
        ...p,
        objects: p.objects
          .filter((o) => o.id !== id)
          .map((o) => {
            if (o.type !== "matter") return o;
            return {
              ...o,
              config: {
                ...o.config,
                emitterId: o.config.emitterId === id ? null : o.config.emitterId,
                fieldIds: o.config.fieldIds.filter((f) => f !== id),
              },
            };
          }),
      };
    }, "Delete object"),

  duplicateObject: (id) =>
    get().commit((p) => {
      const target = p.objects.find((o) => o.id === id);
      if (!target || target.type === "camera") return p;
      const copy = structuredClone(target);
      copy.id = uid(target.type);
      copy.name = `${target.name} copy`;
      if (copy.type === "emitter" || copy.type === "field") copy.config.seed = randomSeed();
      return { ...p, objects: [...p.objects, copy] };
    }, "Duplicate object"),

  renameObject: (id, name) => get().setObjectPath(id, "name", name, "coalesce"),

  toggleObject: (id) => {
    const obj = get().project.objects.find((o) => o.id === id);
    if (!obj) return;
    get().setObjectPath(id, "enabled", !obj.enabled, "push");
  },

  toggleMatterField: (matterId, fieldId) =>
    get().commit((p) => {
      const obj = p.objects.find((o) => o.id === matterId);
      if (!obj || obj.type !== "matter") return p;
      const has = obj.config.fieldIds.includes(fieldId);
      const fieldIds = has
        ? obj.config.fieldIds.filter((f) => f !== fieldId)
        : [...obj.config.fieldIds, fieldId];
      const updated: SceneObject = { ...obj, config: { ...obj.config, fieldIds } };
      return {
        ...p,
        objects: p.objects.map((o) => (o.id === matterId ? updated : o)),
      };

    }, "Toggle field link"),

  updateGradient: (index, updater, label, mode = "coalesce") =>
    get().commit((p) => {
      const gradients = [...p.color.gradients] as Project["color"]["gradients"];
      const current = gradients[index];
      if (!current) return p;
      gradients[index] = updater(current);
      return { ...p, color: { ...p.color, gradients } };
    }, label, mode),

  applyPalette: (paletteId) =>
    get().commit((p) => {
      const preset = PALETTES.find((x) => x.id === paletteId);
      if (!preset) return p;
      return {
        ...p,
        color: {
          ...p.color,
          gradients: paletteGradients(preset),
          roles: {
            ...p.color.roles,
            background: { ...p.color.roles.background, color: preset.background },
          },
        },
      };
    }, `Palette: ${paletteId}`),

  setModulation: (key, mod) =>
    get().commit((p) => {
      const modulations = { ...p.modulations };
      if (mod) modulations[key] = mod;
      else delete modulations[key];
      return { ...p, modulations };
    }, "Modulation"),

  undo: () => {
    const { past, future, project } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    coalesceKey = "";
    set({
      project: prev.project,
      past: past.slice(0, -1),
      future: [...future, { project, label: prev.label }],
    });
    scheduleAutosave(get);
  },

  redo: () => {
    const { past, future, project } = get();
    const next = future[future.length - 1];
    if (!next) return;
    coalesceKey = "";
    set({
      project: next.project,
      future: future.slice(0, -1),
      past: [...past, { project, label: next.label }],
    });
    scheduleAutosave(get);
  },

  setRebuilding: (v) => set({ rebuilding: v }),
  setLoopTime: (t) => set({ loopTime: t }),
}));

/* ------------------------------------------------------------------------- */

import {
  createEmitter,
  createField,
  createMatter,
} from "@/domain/scene/factories";
import type { FieldKind, MatterKind } from "@/domain/types";

function buildObject(type: Exclude<SceneObjectType, "camera">, kind: string): SceneObject {
  if (type === "emitter") {
    return createEmitter(`${label(kind)} Emitter`, { shape: kind as never });
  }
  if (type === "field") {
    return createField(kind as FieldKind, `${label(kind)} Field`);
  }
  return createMatter(kind as MatterKind, label(kind));
}

const label = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

export const selectSelectedObject = (s: EditorState): SceneObject | null =>
  s.project.objects.find((o) => o.id === s.selectedId) ?? null;
