import {
  Button,
  NumberInput,
  Row,
  Section,
  Select,
  Slider,
  TextInput,
  Toggle,
  Vector3Input,
} from "./controls/Controls";
import { useEditor, selectSelectedObject } from "@/state/store";
import type {
  CameraObject,
  ColorSource,
  EmitterObject,
  FieldObject,
  MatterObject,
  SceneObject,
} from "@/domain/types";

/** Property inspector for the selected scene object. */
export function Inspector() {
  const object = useEditor(selectSelectedObject);
  const objects = useEditor((s) => s.project.objects);
  const setObjectPath = useEditor((s) => s.setObjectPath);
  const renameObject = useEditor((s) => s.renameObject);
  const toggleObject = useEditor((s) => s.toggleObject);
  const duplicateObject = useEditor((s) => s.duplicateObject);
  const deleteObject = useEditor((s) => s.deleteObject);
  const toggleMatterField = useEditor((s) => s.toggleMatterField);

  if (!object) {
    return (
      <Section title="Inspector">
        <p className="text-xs text-muted-foreground">Select an object in the scene list to edit it.</p>
      </Section>
    );
  }

  const set = (path: string, value: unknown, push = false) =>
    setObjectPath(object.id, path, value, push ? "push" : "coalesce");
  const num = (path: string, value: number, min: number, max: number, step?: number) => (
    <Slider value={value} min={min} max={max} step={step ?? 0.01} onChange={(v) => set(path, v)} />
  );

  return (
    <>
      <Section title={`${object.type} · inspector`}>
        <Row label="Name">
          <TextInput value={object.name} onChange={(v) => renameObject(object.id, v)} />
        </Row>
        <Row label="Enabled">
          <Toggle
            checked={object.enabled}
            onChange={() => toggleObject(object.id)}
            label="Enabled"
          />
        </Row>
        {object.type !== "camera" ? (
          <div className="flex gap-1.5">
            <Button variant="outline" size="xs" onClick={() => duplicateObject(object.id)}>
              Duplicate
            </Button>
            <Button variant="danger" size="xs" onClick={() => deleteObject(object.id)}>
              Delete
            </Button>
          </div>
        ) : null}
      </Section>

      <Section title="Transform">
        <Row label="Position">
          <Vector3Input
            value={object.transform.position}
            onChange={(axis, v) => set(`transform.position.${axis}`, v)}
          />
        </Row>
        <Row label="Rotation">
          <Vector3Input
            value={object.transform.rotation}
            onChange={(axis, v) => set(`transform.rotation.${axis}`, v)}
          />
        </Row>
        <Row label="Scale">
          <Vector3Input
            value={object.transform.scale}
            onChange={(axis, v) => set(`transform.scale.${axis}`, v)}
          />
        </Row>
      </Section>

      {object.type === "camera" ? <CameraFields object={object} set={set} num={num} /> : null}
      {object.type === "emitter" ? <EmitterFields object={object} set={set} num={num} /> : null}
      {object.type === "field" ? <FieldFields object={object} set={set} num={num} /> : null}
      {object.type === "matter" ? (
        <MatterFields
          object={object}
          objects={objects}
          set={set}
          num={num}
          toggleField={(fieldId) => toggleMatterField(object.id, fieldId)}
        />
      ) : null}
    </>
  );
}

type Setter = (path: string, value: unknown, push?: boolean) => void;
type Num = (path: string, value: number, min: number, max: number, step?: number) => JSX.Element;

function CameraFields({ object, set, num }: { object: CameraObject; set: Setter; num: Num }) {
  const c = object.config;
  return (
    <>
      <Section title="Lens">
        <Row label="FOV">{num("config.fov", c.fov, 10, 120, 0.5)}</Row>
        <Row label="Near">{num("config.near", c.near, 0.01, 5, 0.01)}</Row>
        <Row label="Far">{num("config.far", c.far, 10, 400, 1)}</Row>
        <Row label="Focus">{num("config.focusDistance", c.focusDistance, 0.1, 60, 0.1)}</Row>
        <Row label="Aperture">{num("config.aperture", c.aperture, 0, 1)}</Row>
      </Section>
      <Section title="Camera motion">
        <Row label="Type">
          <Select
            value={c.motion.type}
            options={[
              { value: "static", label: "Static" },
              { value: "orbit", label: "Orbit" },
              { value: "pushIn", label: "Push in" },
              { value: "pullOut", label: "Pull out" },
              { value: "drift", label: "Drift" },
              { value: "roll", label: "Roll" },
              { value: "noise", label: "Noise" },
            ]}
            onChange={(v) => set("config.motion.type", v, true)}
          />
        </Row>
        <Row label="Speed">{num("config.motion.speed", c.motion.speed, 0, 4)}</Row>
        <Row label="Radius">{num("config.motion.radius", c.motion.radius, 0, 20, 0.05)}</Row>
        <Row label="Elevation">{num("config.motion.elevation", c.motion.elevation, -10, 10, 0.05)}</Row>
        <Row label="Phase">{num("config.motion.phase", c.motion.phase, 0, 1)}</Row>
        <Row label="Amount">{num("config.motion.amount", c.motion.amount, 0, 2)}</Row>
        <Row label="Smoothness">{num("config.motion.smoothness", c.motion.smoothness, 0, 1)}</Row>
      </Section>
    </>
  );
}

function EmitterFields({ object, set, num }: { object: EmitterObject; set: Setter; num: Num }) {
  const c = object.config;
  return (
    <Section title="Emitter">
      <Row label="Shape">
        <Select
          value={c.shape}
          options={[
            { value: "point", label: "Point" },
            { value: "sphere", label: "Sphere" },
            { value: "shell", label: "Shell" },
            { value: "box", label: "Box" },
            { value: "ring", label: "Ring" },
            { value: "disc", label: "Disc" },
          ]}
          onChange={(v) => set("config.shape", v, true)}
        />
      </Row>
      <Row label="Spawn">
        <Select
          value={c.spawnMode}
          options={[
            { value: "static", label: "Static" },
            { value: "burst", label: "Burst" },
            { value: "continuous", label: "Continuous" },
          ]}
          onChange={(v) => set("config.spawnMode", v, true)}
        />
      </Row>
      <Row label="Radius">{num("config.radius", c.radius, 0, 12, 0.01)}</Row>
      <Row label="Thickness">{num("config.thickness", c.thickness, 0, 1)}</Row>
      <Row label="Density">{num("config.density", c.density, 0, 2)}</Row>
      <Row label="Velocity">{num("config.initialVelocity", c.initialVelocity, 0, 5)}</Row>
      <Row label="Vel. var">{num("config.velocityVariation", c.velocityVariation, 0, 1)}</Row>
      <Row label="Spread">{num("config.spread", c.spread, 0, 1)}</Row>
      <Row label="Seed">
        <div className="flex items-center gap-1.5">
          <NumberInput value={c.seed} step={1} min={0} onChange={(v) => set("config.seed", Math.round(v), true)} />
          <Button
            variant="outline"
            size="xs"
            onClick={() => set("config.seed", Math.floor(Math.random() * 999999), true)}
          >
            ⟳
          </Button>
        </div>
      </Row>
    </Section>
  );
}

function FieldFields({ object, set, num }: { object: FieldObject; set: Setter; num: Num }) {
  const c = object.config;
  return (
    <Section title="Field">
      <Row label="Kind">
        <Select
          value={c.kind}
          options={[
            { value: "radial", label: "Radial" },
            { value: "vortex", label: "Vortex" },
            { value: "attractor", label: "Attractor" },
            { value: "repulsor", label: "Repulsor" },
            { value: "curl", label: "Curl noise" },
            { value: "directional", label: "Directional" },
          ]}
          onChange={(v) => set("config.kind", v, true)}
        />
      </Row>
      <Row label="Strength">{num("config.strength", c.strength, -5, 5)}</Row>
      <Row label="Radius">{num("config.radius", c.radius, 0.1, 20, 0.05)}</Row>
      <Row label="Falloff">{num("config.falloff", c.falloff, 0, 4)}</Row>
      <Row label="Frequency">{num("config.frequency", c.frequency, 0.05, 6, 0.01)}</Row>
      <Row label="Speed">{num("config.temporalSpeed", c.temporalSpeed, 0, 4)}</Row>
      <Row label="Twist">{num("config.twist", c.twist, -3, 3)}</Row>
      <Row label="Distortion">{num("config.noiseDistortion", c.noiseDistortion, 0, 2)}</Row>
      <Row label="Pulse">{num("config.pulse", c.pulse, 0, 2)}</Row>
      <Row label="Octaves">{num("config.octaves", c.octaves, 1, 5, 1)}</Row>
      <Row label="Direction">
        <Vector3Input
          value={c.direction}
          onChange={(axis, v) => set(`config.direction.${axis}`, v)}
        />
      </Row>
      <Row label="Seed">
        <NumberInput value={c.seed} step={1} min={0} onChange={(v) => set("config.seed", Math.round(v), true)} />
      </Row>
    </Section>
  );
}

function MatterFields({
  object,
  objects,
  set,
  num,
  toggleField,
}: {
  object: MatterObject;
  objects: SceneObject[];
  set: Setter;
  num: Num;
  toggleField: (fieldId: string) => void;
}) {
  const c = object.config;
  const emitters = objects.filter((o) => o.type === "emitter");
  const fields = objects.filter((o) => o.type === "field");
  return (
    <>
      <Section title="Matter">
        <Row label="Kind">
          <Select
            value={c.kind}
            options={[
              { value: "particles", label: "Particles" },
              { value: "soft", label: "Soft bodies" },
              { value: "cells", label: "Cells" },
              { value: "blobs", label: "Blobs" },
            ]}
            onChange={(v) => set("config.kind", v, true)}
          />
        </Row>
        <Row label="Count">
          <Slider
            value={c.count}
            min={256}
            max={200000}
            step={256}
            precision={0}
            onChange={(v) => set("config.count", Math.round(v))}
          />
        </Row>
        <Row label="Size">{num("config.size", c.size, 0.1, 20, 0.05)}</Row>
        <Row label="Size var">{num("config.sizeVariation", c.sizeVariation, 0, 1)}</Row>
        <Row label="Opacity">{num("config.opacity", c.opacity, 0, 1)}</Row>
        <Row label="Softness">{num("config.softness", c.softness, 0, 1)}</Row>
        <Row label="Glow">{num("config.glow", c.glow, 0, 4)}</Row>
        <Row label="Emission">{num("config.emission", c.emission, 0, 4)}</Row>
        <Row label="Drag">{num("config.drag", c.drag, 0, 1)}</Row>
        <Row label="Stretch">{num("config.velocityStretch", c.velocityStretch, 0, 3)}</Row>
        <Row label="Lifetime">{num("config.lifetime", c.lifetime, 0.1, 30, 0.1)}</Row>
        <Row label="Life var">{num("config.lifetimeVariation", c.lifetimeVariation, 0, 1)}</Row>
      </Section>

      <Section title="Cell behaviour" defaultOpen={false}>
        <Row label="Separation">{num("config.separation", c.separation, 0, 2)}</Row>
        <Row label="Merge">{num("config.merge", c.merge, 0, 2)}</Row>
        <Row label="Mutation">{num("config.mutation", c.mutation, 0, 2)}</Row>
        <Row label="Cluster">{num("config.clusterRadius", c.clusterRadius, 0, 5, 0.01)}</Row>
        <Row label="Surface">{num("config.surfaceNoise", c.surfaceNoise, 0, 2)}</Row>
      </Section>

      <Section title="Links">
        <Row label="Emitter">
          <Select
            value={c.emitterId ?? ""}
            options={[{ value: "", label: "None" }, ...emitters.map((e) => ({ value: e.id, label: e.name }))]}
            onChange={(v) => set("config.emitterId", v === "" ? null : v, true)}
          />
        </Row>
        <div className="space-y-1">
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">No fields in the scene.</p>
          ) : null}
          {fields.map((f) => (
            <label
              key={f.id}
              className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs text-muted-foreground"
            >
              <span className="truncate">{f.name}</span>
              <Toggle
                checked={c.fieldIds.includes(f.id)}
                onChange={() => toggleField(f.id)}
                label={`Link ${f.name}`}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Color mapping">
        <Row label="Gradient">
          <Select
            value={String(c.gradientIndex)}
            options={[
              { value: "0", label: "Gradient 1" },
              { value: "1", label: "Gradient 2" },
              { value: "2", label: "Gradient 3" },
            ]}
            onChange={(v) => set("config.gradientIndex", Number(v), true)}
          />
        </Row>
        <Row label="Source">
          <Select<ColorSource>
            value={c.colorSource}
            options={[
              { value: "brightness", label: "Brightness" },
              { value: "energy", label: "Energy" },
              { value: "depth", label: "Depth" },
              { value: "age", label: "Age" },
              { value: "velocity", label: "Velocity" },
              { value: "radius", label: "Radius" },
              { value: "noise", label: "Noise" },
            ]}
            onChange={(v) => set("config.colorSource", v, true)}
          />
        </Row>
        <Row label="Input min">{num("config.inputMin", c.inputMin, 0, 1)}</Row>
        <Row label="Input max">{num("config.inputMax", c.inputMax, 0, 1)}</Row>
        <Row label="Offset">{num("config.mappingOffset", c.mappingOffset, -1, 1)}</Row>
        <Row label="Invert">
          <Toggle
            checked={c.invertMapping}
            onChange={(v) => set("config.invertMapping", v, true)}
            label="Invert mapping"
          />
        </Row>
        <Row label="Clamp">
          <Toggle
            checked={c.clampMapping}
            onChange={(v) => set("config.clampMapping", v, true)}
            label="Clamp mapping"
          />
        </Row>
      </Section>
    </>
  );
}
