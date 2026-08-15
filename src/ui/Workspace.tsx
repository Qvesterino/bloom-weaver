import { useEffect } from "react";
import { Viewport } from "./Viewport";
import { Inspector } from "./Inspector";
import { GradientEditor } from "./GradientEditor";
import { Outliner } from "./Outliner";
import { Diagnostics } from "./Diagnostics";
import { Button, Row, Section, Select, Slider, Toggle } from "./controls/Controls";
import { useEditor } from "@/state/store";
import { RECIPES, type RecipeId } from "@/domain/recipes";
import { PALETTES } from "@/domain/color/palettes";

export function Workspace() {
  const { project, hydrate, loadRecipe, applyPalette, setPath, undo, redo, activeRecipe } =
    useEditor();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);


  return (
    <div className="grain-overlay flex h-screen flex-col gap-2 bg-background p-2">
      <header className="panel flex items-center gap-3 px-3 py-2">
        <h1 className="text-sm font-semibold tracking-tight">
          Matter<span className="text-primary">Field</span>
        </h1>
        <span className="label-xs">{project.name}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="xs" onClick={undo}>
            Undo
          </Button>
          <Button variant="outline" size="xs" onClick={redo}>
            Redo
          </Button>
          <Button
            variant="primary"
            size="xs"
            onClick={() => setPath("loop.playing", !project.loop.playing, "Toggle playback", "push")}
          >
            {project.loop.playing ? "Pause" : "Play"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[15rem_minmax(0,1fr)_17rem] gap-2">
        <aside className="panel min-h-0 overflow-y-auto">
          <Section title="Scene">
            <div className="space-y-1">
              {project.objects.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => select(o.id)}
                  className={`focus-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                    selectedId === o.id
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="numeric text-primary-dim">{o.type[0]!.toUpperCase()}</span>
                  <span className="truncate">{o.name}</span>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Recipes">
            <div className="grid gap-1">
              {RECIPES.map((r) => (
                <Button
                  key={r.id}
                  variant="outline"
                  size="xs"
                  onClick={() => loadRecipe(r.id as RecipeId)}
                >
                  {r.name}
                </Button>
              ))}
            </div>
          </Section>
        </aside>

        <main className="min-h-0">
          <Viewport />
        </main>

        <aside className="panel min-h-0 overflow-y-auto">
          <Inspector />
          <GradientEditor />
          <Section title="Palette">
            <div className="grid gap-1">
              {PALETTES.slice(0, 8).map((p) => (
                <Button key={p.id} variant="outline" size="xs" onClick={() => applyPalette(p.id)}>
                  {p.name}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="Optics">
            <Row label="Bloom">
              <Toggle
                checked={project.optics.bloom.enabled}
                onChange={(v) => setPath("optics.bloom.enabled", v, "Bloom", "push")}
              />
            </Row>
            <Row label="Intensity">
              <Slider
                value={project.optics.bloom.intensity}
                min={0}
                max={3}
                onChange={(v) => setPath("optics.bloom.intensity", v)}
              />
            </Row>
            <Row label="Exposure">
              <Slider
                value={project.optics.tone.exposure}
                min={0}
                max={3}
                onChange={(v) => setPath("optics.tone.exposure", v)}
              />
            </Row>
            <Row label="Grain">
              <Slider
                value={project.optics.grain.amount}
                min={0}
                max={1}
                onChange={(v) => setPath("optics.grain.amount", v)}
              />
            </Row>
          </Section>
          <Section title="Viewport">
            <Row label="Quality">
              <Select
                value={project.viewport.quality}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "interactive", label: "Interactive" },
                  { value: "quality", label: "Quality" },
                ]}
                onChange={(v) => setPath("viewport.quality", v, "Quality", "push")}
              />
            </Row>
            <Row label="Grid">
              <Toggle
                checked={project.viewport.showGrid}
                onChange={(v) => setPath("viewport.showGrid", v, "Grid", "push")}
              />
            </Row>
            <Row label="Stats">
              <Toggle
                checked={project.viewport.diagnostics}
                onChange={(v) => setPath("viewport.diagnostics", v, "Diagnostics", "push")}
              />
            </Row>
          </Section>
        </aside>
      </div>
    </div>
  );
}
