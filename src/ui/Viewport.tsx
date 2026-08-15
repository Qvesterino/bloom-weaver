import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "@/engine/Engine";
import { useEditor } from "@/state/store";
import { useDiagnostics } from "@/state/diagnostics";

/**
 * A WebGL context is a scarce, per-tab resource. React StrictMode and HMR mount
 * effects twice, so a naive "create engine per mount" leaks contexts until the
 * browser refuses to make new ones. We keep one engine alive at module scope and
 * only really dispose it when the viewport stays unmounted.
 */
let sharedEngine: Engine | null = null;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;

function releaseShared() {
  sharedEngine?.dispose();
  sharedEngine = null;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (disposeTimer) clearTimeout(disposeTimer);
    releaseShared();
  });
}

export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const setLoopTime = useEditor((s) => s.setLoopTime);
  const stats = useDiagnostics((s) => s.stats);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (disposeTimer) {
      clearTimeout(disposeTimer);
      disposeTimer = null;
    }
    const diag = useDiagnostics.getState();
    const callbacks = {
      onStats: diag.setStats,
      onLoopTime: setLoopTime,
      onError: (message: string) => {
        setError(message);
        diag.log("error", message);
      },
      onContextState: diag.setContext,
    };

    if (sharedEngine && !sharedEngine.isAlive()) releaseShared();

    if (sharedEngine) {
      sharedEngine.setCallbacks(callbacks);
      host.appendChild(sharedEngine.element);
      sharedEngine.setProject(useEditor.getState().project);
      sharedEngine.start();
      setError(null);
    } else {
      const canvas = document.createElement("canvas");
      canvas.className = "block h-full w-full";
      host.appendChild(canvas);
      try {
        sharedEngine = new Engine(canvas, useEditor.getState().project, callbacks);
        sharedEngine.start();
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        canvas.remove();
        sharedEngine = null;
        setError(message);
        diag.setContext("failed", message);
      }
    }

    return () => {
      const engine = sharedEngine;
      if (!engine) return;
      engine.stop();
      engine.element.remove();
      // Give a possible StrictMode/HMR remount a tick to reclaim this engine.
      disposeTimer = setTimeout(() => {
        disposeTimer = null;
        if (!engine.element.isConnected) releaseShared();
      }, 400);
    };
  }, [setLoopTime, attempt]);

  useEffect(() => {
    if (!sharedEngine?.isAlive()) return;
    sharedEngine.setProject(project);
    sharedEngine.syncCameraPosition();
  }, [project]);

  useEffect(() => {
    sharedEngine?.setSelected(selectedId);
  }, [selectedId]);

  const retry = useCallback(() => {
    if (disposeTimer) {
      clearTimeout(disposeTimer);
      disposeTimer = null;
    }
    releaseShared();
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface-sunken"
    >
      {project.viewport.diagnostics && stats ? (
        <div className="numeric pointer-events-none absolute top-3 left-3 space-y-0.5 rounded-md border border-border bg-background/70 px-2.5 py-2 text-muted-foreground backdrop-blur">
          <div>{stats.fps.toFixed(0)} fps · {stats.frameTime.toFixed(1)} ms</div>
          <div>{stats.particles.toLocaleString()} particles</div>
          <div>{stats.cells.toLocaleString()} cells · {stats.activeFields} fields</div>
          <div>{stats.textures} tex · {stats.geometries} buf · {stats.drawCalls} calls</div>
          <div>scale {stats.renderScale} · {project.viewport.quality}</div>
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-md border border-destructive/50 bg-background/90 px-3 py-2 text-xs text-destructive">
          <span>Renderer stopped: {error}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded border border-destructive/60 px-2 py-1 text-destructive transition hover:bg-destructive/10"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

