import { useState } from "react";
import { Button, Section, Select } from "./controls/Controls";
import { useEditor } from "@/state/store";
import type { SceneObject, SceneObjectType } from "@/domain/types";

const ADDABLE: { type: Exclude<SceneObjectType, "camera">; kind: string; label: string }[] = [
  { type: "emitter", kind: "sphere", label: "Emitter · Sphere" },
  { type: "emitter", kind: "shell", label: "Emitter · Shell" },
  { type: "emitter", kind: "ring", label: "Emitter · Ring" },
  { type: "emitter", kind: "disc", label: "Emitter · Disc" },
  { type: "emitter", kind: "box", label: "Emitter · Box" },
  { type: "field", kind: "radial", label: "Field · Radial" },
  { type: "field", kind: "vortex", label: "Field · Vortex" },
  { type: "field", kind: "attractor", label: "Field · Attractor" },
  { type: "field", kind: "repulsor", label: "Field · Repulsor" },
  { type: "field", kind: "curl", label: "Field · Curl" },
  { type: "field", kind: "directional", label: "Field · Directional" },
  { type: "matter", kind: "particles", label: "Matter · Particles" },
  { type: "matter", kind: "soft", label: "Matter · Soft" },
  { type: "matter", kind: "cells", label: "Matter · Cells" },
  { type: "matter", kind: "blobs", label: "Matter · Blobs" },
];

const GROUPS: { type: SceneObjectType; title: string }[] = [
  { type: "camera", title: "Camera" },
  { type: "matter", title: "Matter" },
  { type: "emitter", title: "Emitters" },
  { type: "field", title: "Fields" },
];

/**
 * Scene outliner: selection drives the inspector context, and every structural
 * edit goes through store commits so undo/redo covers it.
 */
export function Outliner() {
  const objects = useEditor((s) => s.project.objects);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const addObject = useEditor((s) => s.addObject);
  const duplicateObject = useEditor((s) => s.duplicateObject);
  const deleteObject = useEditor((s) => s.deleteObject);
  const toggleObject = useEditor((s) => s.toggleObject);
  const [addChoice, setAddChoice] = useState("emitter:sphere");

  const renderRow = (o: SceneObject) => {
    const active = selectedId === o.id;
    return (
      <div
        key={o.id}
        className={`group flex items-center gap-1 rounded px-1.5 py-1 transition-colors ${
          active ? "bg-primary/15" : "hover:bg-muted"
        }`}
      >
        <button
          type="button"
          onClick={() => select(o.id)}
          className={`focus-ring flex min-w-0 flex-1 items-center gap-2 rounded text-left text-xs ${
            active ? "text-foreground" : "text-muted-foreground"
          } ${o.enabled ? "" : "opacity-50"}`}
        >
          <span className="numeric text-primary-dim">{o.type[0]!.toUpperCase()}</span>
          <span className="truncate">{o.name}</span>
        </button>
        <button
          type="button"
          title={o.enabled ? "Disable" : "Enable"}
          onClick={() => toggleObject(o.id)}
          className="focus-ring rounded px-1 text-[0.6rem] text-muted-foreground hover:text-foreground"
        >
          {o.enabled ? "on" : "off"}
        </button>
        {o.type === "camera" ? null : (
          <>
            <button
              type="button"
              title="Duplicate"
              onClick={() => duplicateObject(o.id)}
              className="focus-ring rounded px-1 text-[0.6rem] text-muted-foreground hover:text-foreground"
            >
              dup
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => {
                if (selectedId === o.id) select(null);
                deleteObject(o.id);
              }}
              className="focus-ring rounded px-1 text-[0.6rem] text-muted-foreground hover:text-destructive"
            >
              del
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <Section title="Scene">
      <div className="space-y-2">
        {GROUPS.map((g) => {
          const rows = objects.filter((o) => o.type === g.type);
          if (rows.length === 0) return null;
          return (
            <div key={g.type} className="space-y-0.5">
              <p className="label-xs px-1.5">{g.title}</p>
              {rows.map(renderRow)}
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1">
        <Select
          value={addChoice}
          options={ADDABLE.map((a) => ({ value: `${a.type}:${a.kind}`, label: a.label }))}
          onChange={setAddChoice}
        />
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            const [type, kind] = addChoice.split(":") as [
              Exclude<SceneObjectType, "camera">,
              string,
            ];
            addObject(type, kind);
          }}
        >
          Add object
        </Button>
      </div>
    </Section>
  );
}
