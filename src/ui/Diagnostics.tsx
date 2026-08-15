import { Button, Section } from "./controls/Controls";
import { useDiagnostics } from "@/state/diagnostics";

const CONTEXT_TONE: Record<string, string> = {
  created: "text-primary",
  restored: "text-primary",
  idle: "text-muted-foreground",
  lost: "text-destructive",
  failed: "text-destructive",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="label-xs">{label}</span>
      <span className="numeric text-xs text-foreground">{value}</span>
    </div>
  );
}

/** Live WebGL / GPU resource readout plus an error log for failure triage. */
export function Diagnostics() {
  const stats = useDiagnostics((s) => s.stats);
  const contextState = useDiagnostics((s) => s.contextState);
  const contextMessage = useDiagnostics((s) => s.contextMessage);
  const logs = useDiagnostics((s) => s.logs);
  const clearLogs = useDiagnostics((s) => s.clearLogs);

  return (
    <Section title="Diagnostics">
      <div className="space-y-1">
        <Stat label="WebGL context" value={contextState} />
        <p className={`text-[0.65rem] leading-snug ${CONTEXT_TONE[contextState] ?? ""}`}>
          {contextMessage}
        </p>
        <Stat label="FPS" value={stats ? stats.fps.toFixed(0) : "—"} />
        <Stat label="Frame time" value={stats ? `${stats.frameTime.toFixed(1)} ms` : "—"} />
        <Stat label="Particles" value={stats ? stats.particles.toLocaleString() : "—"} />
        <Stat label="Cells" value={stats ? stats.cells.toLocaleString() : "—"} />
        <Stat label="Active fields" value={stats ? String(stats.activeFields) : "—"} />
        <Stat label="Textures" value={stats ? String(stats.textures) : "—"} />
        <Stat label="Geometries / buffers" value={stats ? String(stats.geometries) : "—"} />
        <Stat label="Shader programs" value={stats ? String(stats.programs) : "—"} />
        <Stat label="Draw calls" value={stats ? String(stats.drawCalls) : "—"} />
        <Stat label="Points drawn" value={stats ? stats.points.toLocaleString() : "—"} />
        <Stat label="Render scale" value={stats ? String(stats.renderScale) : "—"} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="label-xs">Log</span>
        <Button variant="outline" size="xs" onClick={clearLogs}>
          Clear
        </Button>
      </div>
      <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-border bg-surface-sunken p-2">
        {logs.length === 0 ? (
          <p className="text-[0.65rem] text-muted-foreground">No events recorded.</p>
        ) : (
          logs
            .slice()
            .reverse()
            .map((l) => (
              <div key={l.id} className="text-[0.65rem] leading-snug">
                <span className="numeric text-muted-foreground">
                  {new Date(l.time).toLocaleTimeString()}{" "}
                </span>
                <span className={l.level === "error" ? "text-destructive" : l.level === "warn" ? "text-primary" : "text-muted-foreground"}>
                  {l.message}
                </span>
              </div>
            ))
        )}
      </div>
    </Section>
  );
}
