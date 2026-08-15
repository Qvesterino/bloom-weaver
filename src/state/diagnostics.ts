import { create } from "zustand";
import type { ContextState, EngineStats } from "@/engine/Engine";

export interface LogEntry {
  id: number;
  time: number;
  level: "info" | "warn" | "error";
  message: string;
}

interface DiagnosticsState {
  stats: EngineStats | null;
  contextState: ContextState | "idle";
  contextMessage: string;
  logs: LogEntry[];
  setStats: (stats: EngineStats) => void;
  setContext: (state: ContextState, message: string) => void;
  log: (level: LogEntry["level"], message: string) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 60;
let logId = 0;

/**
 * Diagnostics live outside the project store on purpose: they tick several times
 * a second and must never enter the undo history or trigger project autosaves.
 */
export const useDiagnostics = create<DiagnosticsState>((set) => ({
  stats: null,
  contextState: "idle",
  contextMessage: "waiting for renderer",
  logs: [],
  setStats: (stats) => set({ stats }),
  setContext: (contextState, contextMessage) =>
    set((s) => ({
      contextState,
      contextMessage,
      logs: appendLog(s.logs, {
        id: ++logId,
        time: Date.now(),
        level: contextState === "lost" || contextState === "failed" ? "error" : "info",
        message: contextMessage,
      }),
    })),
  log: (level, message) =>
    set((s) => ({ logs: appendLog(s.logs, { id: ++logId, time: Date.now(), level, message }) })),
  clearLogs: () => set({ logs: [] }),
}));

function appendLog(logs: LogEntry[], entry: LogEntry): LogEntry[] {
  const last = logs[logs.length - 1];
  if (last && last.message === entry.message && last.level === entry.level) return logs;
  return [...logs, entry].slice(-MAX_LOGS);
}
