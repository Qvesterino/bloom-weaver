import { useRef, useState } from "react";
import { Button, ColorInput, Row, Section, Select, Slider } from "./controls/Controls";
import { useEditor } from "@/state/store";
import { uid } from "@/domain/id";
import { gradientToCss, sampleGradient, rgbToHex } from "@/domain/color/gradient";
import type { Gradient, GradientStop, Interpolation } from "@/domain/types";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Multi-stop gradient editor wired straight into the color engine. */
export function GradientEditor() {
  const project = useEditor((s) => s.project);
  const updateGradient = useEditor((s) => s.updateGradient);
  const [index, setIndex] = useState(0);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);

  const gradient = project.color.gradients[index] ?? project.color.gradients[0]!;
  const stops = [...gradient.stops].sort((a, b) => a.position - b.position);
  const active = stops.find((s) => s.id === selectedStop) ?? stops[0];

  const patch = (updater: (g: Gradient) => Gradient, label: string, mode?: "push" | "coalesce") =>
    updateGradient(index, updater, label, mode ?? "coalesce");

  const setStop = (id: string, values: Partial<GradientStop>, mode?: "push" | "coalesce") =>
    patch(
      (g) => ({ ...g, stops: g.stops.map((s) => (s.id === id ? { ...s, ...values } : s)) }),
      "Edit gradient stop",
      mode,
    );

  const positionFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const addStopAt = (position: number) => {
    const [r, g2, b] = sampleGradient(gradient, position);
    const stop: GradientStop = {
      id: uid("stop"),
      position,
      color: rgbToHex([r, g2, b]),
      opacity: 1,
    };
    setSelectedStop(stop.id);
    patch((g) => ({ ...g, stops: [...g.stops, stop] }), "Add gradient stop", "push");
  };

  const removeStop = (id: string) => {
    if (gradient.stops.length <= 2) return;
    patch((g) => ({ ...g, stops: g.stops.filter((s) => s.id !== id) }), "Remove gradient stop", "push");
    setSelectedStop(null);
  };

  return (
    <Section title="Gradient">
      <Select
        value={String(index)}
        options={project.color.gradients.map((g, i) => ({
          value: String(i),
          label: `${i + 1} · ${g.name}`,
        }))}
        onChange={(v) => {
          setIndex(Number(v));
          setSelectedStop(null);
        }}
      />

      <div
        ref={trackRef}
        className="relative h-9 cursor-copy rounded-md border border-border-strong"
        style={{ backgroundImage: gradientToCss(gradient, 48) }}
        onDoubleClick={(e) => addStopAt(positionFromEvent(e.clientX))}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          setStop(dragging.current, { position: positionFromEvent(e.clientX) });
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerLeave={() => {
          dragging.current = null;
        }}
        title="Double-click to add a stop · drag handles to move"
      >
        {stops.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Stop at ${(s.position * 100).toFixed(0)}%`}
            onPointerDown={(e) => {
              e.preventDefault();
              setSelectedStop(s.id);
              dragging.current = s.id;
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              removeStop(s.id);
            }}
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 transition-shadow ${
              active?.id === s.id ? "border-foreground shadow-glow" : "border-background"
            }`}
            style={{ left: `${s.position * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="xs" onClick={() => addStopAt(0.5)}>
          Add stop
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            patch(
              (g) => ({ ...g, stops: g.stops.map((s) => ({ ...s, position: 1 - s.position })) }),
              "Reverse gradient",
              "push",
            )
          }
        >
          Reverse
        </Button>
        <Button
          variant="danger"
          size="xs"
          disabled={!active || stops.length <= 2}
          onClick={() => active && removeStop(active.id)}
        >
          Delete
        </Button>
      </div>

      <Row label="Interpolate">
        <Select<Interpolation>
          value={gradient.interpolation}
          options={[
            { value: "oklch", label: "OKLCH (perceptual)" },
            { value: "rgb", label: "RGB" },
            { value: "hsl", label: "HSL" },
          ]}
          onChange={(v) => patch((g) => ({ ...g, interpolation: v }), "Interpolation", "push")}
        />
      </Row>

      {active ? (
        <>
          <Row label="Color">
            <ColorInput value={active.color} onChange={(v) => setStop(active.id, { color: v })} />
          </Row>
          <Row label="Position">
            <Slider
              value={active.position}
              min={0}
              max={1}
              onChange={(v) => setStop(active.id, { position: v })}
            />
          </Row>
          <Row label="Opacity">
            <Slider
              value={active.opacity}
              min={0}
              max={1}
              onChange={(v) => setStop(active.id, { opacity: v })}
            />
          </Row>
        </>
      ) : null}
    </Section>
  );
}
