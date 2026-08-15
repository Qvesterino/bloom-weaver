import { useEffect, useRef, useState } from "react";
import { Engine } from "@/engine/Engine";
import { useEditor } from "@/state/store";
import { useDiagnostics } from "@/state/diagnostics";

export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const setLoopTime = useEditor((s) => s.setLoopTime);
  const stats = useDiagnostics((s) => s.stats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const diag = useDiagnostics.getState();
    // A canvas can only ever hold one WebGL context, so each engine instance gets
    // a brand-new canvas. Reusing a React-owned canvas across mounts (StrictMode,
    // HMR) makes context creation fail and leaks GPU memory.
    const canvas = document.createElement("canvas");
    canvas.className = "block h-full w-full";
    host.appendChild(canvas);

    let engine: Engine | null = null;
    try {
      engine = new Engine(canvas, useEditor.getState().project, {
        onStats: diag.setStats,
        onLoopTime: setLoopTime,
        onError: (message) => {
          setError(message);
          diag.log("error", message);
        },
        onContextState: diag.setContext,
      });
      engineRef.current = engine;
      engine.start();
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      diag.setContext("failed", message);
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
      canvas.remove();
    };
  }, [setLoopTime]);

  useEffect(() => {
    engineRef.current?.setProject(project);
    engineRef.current?.syncCameraPosition();
  }, [project]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedId);
  }, [selectedId]);

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
        <div className="absolute inset-x-4 bottom-4 rounded-md border border-destructive/50 bg-background/90 px-3 py-2 text-xs text-destructive">
          Renderer stopped: {error}
        </div>
      ) : null}
    </div>
  );
}
