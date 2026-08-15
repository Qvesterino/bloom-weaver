import type { Project } from "@/domain/types";

const DB_NAME = "matter-field";
const DB_VERSION = 1;
const STORE = "projects";
const META = "meta";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

/** Projects are stored as plain declarative JSON — never Three.js runtime objects. */
export const persistence = {
  async saveProject(project: Project): Promise<void> {
    const clean: Project = JSON.parse(JSON.stringify({ ...project, updatedAt: Date.now() }));
    await tx(STORE, "readwrite", (s) => s.put(clean));
    await tx(META, "readwrite", (s) => s.put(clean.id, "lastProjectId"));
  },
  async loadProject(id: string): Promise<Project | undefined> {
    return tx<Project | undefined>(STORE, "readonly", (s) => s.get(id));
  },
  async listProjects(): Promise<Project[]> {
    const all = await tx<Project[]>(STORE, "readonly", (s) => s.getAll());
    return (all ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async lastProjectId(): Promise<string | undefined> {
    return tx<string | undefined>(META, "readonly", (s) => s.get("lastProjectId"));
  },
  async deleteProject(id: string): Promise<void> {
    await tx(STORE, "readwrite", (s) => s.delete(id));
  },
  /** Crash-recovery snapshot, kept separate from the saved project record. */
  async saveRecovery(project: Project): Promise<void> {
    await tx(META, "readwrite", (s) =>
      s.put(JSON.parse(JSON.stringify(project)) as Project, "recovery"),
    );
  },
  async loadRecovery(): Promise<Project | undefined> {
    return tx<Project | undefined>(META, "readonly", (s) => s.get("recovery"));
  },
};
