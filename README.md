# Bloom Weaver

Lovable Build Prompt — Matter Field

Build a polished, production-quality web application called Matter Field.

Matter Field is a real-time procedural 3D motion laboratory for creating organic, biomorphic, luminous, particle-based animated visuals.

The application should feel like a focused hybrid of:

procedural motion editor,

lightweight 3D scene editor,

particle laboratory,

generative visual instrument,

shader-powered motion design tool.

It is not primarily a shader code editor.

It is not a generic Three.js demo.

It is not a collection of hardcoded visual effects.

It is not a fake UI with sliders that do not meaningfully affect the rendered result.

The goal is to create a genuine editable scene system where users can construct visuals by combining:

matter,

emitters,

procedural force fields,

camera,

motion,

gradients,

color mapping,

optics,

looping,

export.

1. Core Product Philosophy

The application must follow this conceptual pipeline:

3D SCENE
+
MATTER
+
EMITTERS
+
FIELDS
+
MOTION
+
CAMERA
+
COLOR ENGINE
+
OPTICS ENGINE
+
LOOP SYSTEM
=
FINAL ANIMATED VISUAL


The visual examples Matter Field should eventually be capable of producing include:

glowing nebula clouds,

microscopic cell colonies,

radial anemone-like explosions,

floating spores,

soft plasma blobs,

abstract biological motion,

luminous particle swarms,

cosmic dust fields.

These visual families must be built from reusable primitives.

Do NOT implement each visual family as a separate hardcoded shader.

For example, an Anemone preset should be a reusable scene recipe containing something like:

Sphere emitter
+
Radial field
+
Curl field
+
Particles
+
Soft blobs
+
Purple gradient
+
Heavy bloom
+
Camera motion


Users must be able to inspect and modify all of those elements.

2. Technical Stack

Use:

React

TypeScript

Vite

Three.js

WebGL2

GLSL shader materials where appropriate

Zustand for app/editor state

IndexedDB for local project persistence

Avoid unnecessary dependencies.

The graphics system should remain understandable and modular.

React must only manage UI and editor state.

React must NOT run particle simulations or per-frame visual logic.

Use requestAnimationFrame and renderer-owned simulation logic for graphics.

3. Application Layout

Create a professional dark creative-tool interface.

Recommended structure:

┌──────────────────────────────────────────────────────────────┐
│ TOP BAR                                                      │
├───────────────┬───────────────────────────────┬──────────────┤
│               │                               │              │
│ SCENE         │                               │ INSPECTOR    │
│ OUTLINER      │          3D CANVAS            │              │
│               │                               │              │
│ Camera        │                               │ Transform    │
│ Emitters      │                               │ Matter       │
│ Matter        │                               │ Motion       │
│ Fields        │                               │ Color        │
│               │                               │ Optics       │
│               │                               │              │
├───────────────┴───────────────────────────────┴──────────────┤
│ LOOP / PLAYBACK / MOTION                                     │
└──────────────────────────────────────────────────────────────┘


The canvas should be the dominant visual area.

Target approximately 65–75% of the usable workspace for the canvas.

The UI should feel:

serious,

refined,

dense but readable,

visually modern,

responsive,

creative-tool oriented.

Avoid excessive rounded-card dashboard aesthetics.

This is an editor, not a SaaS admin page.

4. Top Bar

Include:

app name: Matter Field

New Project

Save

Duplicate

Undo

Redo

Presets / Recipes

Preview Quality

Export

Also show current project name.

5. Scene Outliner

Create a tree-style outliner.

Scene objects should include:

Scene

Camera

Emitters
  Core Emitter

Matter
  Main Particles
  Cells

Fields
  Radial Field
  Curl Field


Users must be able to:

select,

rename,

duplicate,

delete,

enable/disable objects.

Selection determines what appears in the inspector.

Do not hardcode the inspector around a single scene.

6. Scene Object Model

Create reusable types such as:

type SceneObjectType =
  | "camera"
  | "emitter"
  | "matter"
  | "field";


Each object must have:

id
name
type
enabled
transform
config


Transform:

position: { x, y, z }
rotation: { x, y, z }
scale: { x, y, z }


Use stable IDs.

7. 3D Viewport

Use Three.js.

The viewport must support:

perspective camera,

orbit navigation,

pan,

zoom,

reset view,

optional scene grid toggle,

optional helper overlays.

The editor camera and the render camera should be clearly distinguishable if necessary.

Avoid excessive helper clutter.

The render should remain visually clean.

8. Camera System

Camera must be a first-class editable scene object.

Provide controls for:

Transform

Position X

Position Y

Position Z

Rotation X

Rotation Y

Rotation Z

Lens

FOV

Near

Far

Focus

Focus Distance

Aperture / DOF Amount

Camera Motion

Support at least:

Static

Orbit

Push In

Pull Out

Drift

Roll

Noise

For Orbit expose:

radius

speed

elevation

phase

For Drift:

amount

speed

smoothness

Camera motion must be driven by the motion engine, not by React rerenders.

9. Emitters

Create reusable emitter objects.

Initial emitter types:

Point

Sphere

Sphere Shell

Box

Ring

Disc

Emitter controls:

Shape

Radius

Density

Seed

Spawn Mode

Initial Velocity

Velocity Variation

Spread

Spawn modes:

Static Population

Burst

Continuous

Emitter helpers should optionally appear in the viewport when selected.

10. Matter Systems

Create reusable matter objects.

Initial matter types:

Particles

Soft Particles

Cells

Blobs

Each matter system links to an emitter and one or more fields.

11. GPU Particle System

Implement a real particle system.

Do NOT create one React component or Three.js mesh per particle.

Use GPU-friendly rendering.

Target particle presets:

8K

16K

32K

64K

128K

If practical, support 256K on capable hardware.

Particle controls:

Particle Count

Size

Size Variation

Opacity

Softness

Glow

Emission

Drag

Lifetime

Lifetime Variation

Velocity Stretch

Particle count may require GPU resource rebuild.

Other visual parameters should update in realtime.

12. Particle Motion

Particle velocity should be influenced by linked fields.

Conceptually:

velocity += radialField(position)
velocity += curlField(position)
velocity += attractor(position)
velocity *= drag
position += velocity * dt


The motion must be visibly responsive to field controls.

Do not fake controls with decorative UI.

13. Cells

Create a distinct cell-style matter mode.

Cell controls:

Cell Count

Cell Scale

Scale Variation

Cluster Radius

Separation

Merge

Mutation

Softness

Glow

Initial implementation may use:

instanced spheres,

billboard blobs,

soft shader sprites,

screen-space blob composition.

The user-facing concept must remain Cells.

Do not expose implementation details unnecessarily.

14. Blobs

Create soft organic blob matter.

Controls:

Blob Count

Radius

Radius Variation

Softness

Emission

Merge Strength

Surface Noise

Blobs should visually blend or overlap softly.

15. Force Fields

Implement world-space force field objects.

Initial field types:

Radial

Vortex

Attractor

Repulsor

Curl / Turbulence

Directional

Each field has:

Position

Rotation

Radius

Strength

Falloff

Frequency

Temporal Speed

Seed

16. Radial Field

Support:

outward force

inward force

Controls:

Strength

Radius

Falloff

Noise Distortion

Pulse

This field is essential for Anemone-style visuals.

17. Vortex Field

Controls:

Strength

Radius

Falloff

Axis

Twist

Turbulence

It should visibly create orbital / spiral movement.

18. Attractor and Repulsor

Attractor pulls particles inward.

Repulsor pushes outward.

Controls:

Strength

Radius

Falloff

Both must be positionable in 3D space.

19. Curl / Turbulence Field

This is one of the most important visual systems.

Create a procedural noise-driven field.

Controls:

Strength

Scale

Frequency

Temporal Speed

Seed

Octaves if practical

Motion should feel smooth and organic.

Do NOT use harsh random jitter.

20. Multiple Fields

A matter system must support multiple active fields.

Example:

Radial
+
Curl
+
Weak Vortex


Users should be able to enable/disable each field independently.

21. Motion Engine

Create a reusable modulation system.

Parameters marked as modulatable should expose a small modulation button.

Example:

Turbulence    0.45    ◉


Clicking it opens modulation settings.

Initial modulation sources:

Sine

Triangle

Smooth Noise

Pulse

Controls:

Amount

Frequency

Phase

Offset

Do not build a full timeline editor.

22. Loop System

Add a global loop engine.

Controls:

Loop Enabled

Loop Duration

Playback Rate

Restart

Play

Pause

Preset durations:

2s

4s

6s

8s

12s

16s

Support custom duration.

Where possible, motion should derive from normalized periodic phase.

Use:

phase01 = time / loopDuration
sinPhase
cosPhase


This should make procedural camera and field animation capable of seamless looping.

23. Color Engine

This is a critical feature.

Do NOT implement color as three simple color pickers.

Build a serious gradient and palette system.

24. Gradient Editor

Create a professional gradient editor.

Required:

add stop

remove stop

drag stop

exact stop position

color picker

opacity per stop

reverse gradient

duplicate gradient

live gradient preview

Support arbitrary multi-stop gradients.

At minimum the UI should comfortably support:

2-stop

3-stop

4-stop

5+ stop gradients

25. Gradient Interpolation

Support:

OKLCH

RGB

HSL

Use perceptual interpolation as the preferred default if implementation is reliable.

26. Gradient LUT

Prefer converting gradients to a small 1D lookup texture.

Example:

256 × 1


Shaders sample the LUT instead of containing hardcoded color logic.

27. Color Mapping Sources

Allow gradients to map to scene signals.

At least support:

Brightness

Energy

Depth

Particle Age

Velocity

Distance from Center

Noise

If a signal is not applicable to a selected matter type, disable it gracefully.

28. Gradient Mapping Controls

Provide:

Source

Input Min

Input Max

Invert

Offset

Clamp

Changes must update live.

29. Multi-Gradient System

Support three modes.

Single

One gradient.

Dual

Two gradients.

Useful roles:

Matter + Glow

Shadow + Highlight

Triple

Three gradients.

Recommended roles:

Core

Matter

Haze

Do not make the triple-gradient system a fake cosmetic panel.

It must visibly affect the renderer.

30. Color Roles

Add scene-level semantic roles:

Background

Core

Matter

Highlights

Glow

Trails

Haze

Accent

Each role should support:

flat color or gradient where applicable

opacity

emission multiplier

31. Palette Presets

Provide initial palettes such as:

Nebula Cyan

Deep Space

Ultraviolet

Petri Cyan / Pink

Bioluminescent

Toxic Culture

Stellar Gold

Monochrome Ice

Coral Fluorescence

Presets must remain fully editable.

32. Optics Engine

This is another critical subsystem.

Do NOT stop at one generic bloom slider.

Create a dedicated Optics inspector section.

33. Bloom

Implement high-quality bloom.

Controls:

Enabled

Intensity

Threshold

Radius

Softness

Spread

Haze

Prefer multi-resolution bloom if practical.

Use several downsample scales to produce both:

tight glow

broad dreamy haze

Bloom should strongly contribute to the visual identity of the app.

34. Depth of Field

Implement a practical DOF post-process.

Controls:

Enabled

Focus Distance

Aperture

Blur Strength

Foreground Amount

Background Amount

If a full cinematic bokeh solution is too expensive, implement a performant approximated DOF.

It must still respond meaningfully to camera depth.

35. Tone Controls

Add:

Exposure

Contrast

Gamma

Saturation

Highlights

Blacks

These should operate after color mapping.

36. Chromatic Aberration

Controls:

Enabled

Amount

Edge Falloff

Default should be subtle.

37. Grain

Controls:

Enabled

Amount

Scale

Speed

Monochrome / Colored

Grain should be animated unless static mode is selected.

38. Vignette

Controls:

Enabled

Amount

Softness

Roundness

39. Haze / Diffusion

Create a soft atmospheric diffusion effect.

Controls:

Amount

Radius

Brightness Influence

This should not simply blur the entire final image.

Preserve local image detail where possible.

40. Post-Processing Order

Use a controlled internal order.

Recommended:

Scene Render
↓
Color Mapping
↓
Bloom
↓
Depth of Field
↓
Haze
↓
Tone
↓
Chromatic Aberration
↓
Grain
↓
Vignette
↓
Final Composite


Users do not need arbitrary post-effect reordering in V1.

41. Render Architecture

Create an explicit render graph or pass pipeline.

Separate:

simulation

matter rendering

color

optics

final composite

Avoid putting everything into one giant shader.

Each subsystem should have clear responsibility.

42. Render Targets

Reuse render targets.

Do not allocate WebGL render targets every frame.

Create a simple render-target pool or managed set of persistent targets.

Dispose them correctly on project changes and app teardown.

43. Preview Quality

Add quality modes:

Draft

reduced internal resolution

lower preview particle population if necessary

simplified expensive post-process

Interactive

default

Quality

higher internal fidelity

Important:

Preview approximation must not silently mutate the actual project configuration.

44. Internal Render Scale

Support:

50%

75%

100%

The canvas still fills the viewport.

45. Diagnostics

Add a collapsible diagnostics HUD.

Display:

FPS

Frame Time

Particle Count

Cell Count

Active Fields

Draw Calls if available

Render Scale

Current Loop Time

Keep it unobtrusive.

46. Project Persistence

Use IndexedDB.

Projects should save:

scene objects

transforms

emitter settings

matter settings

fields

camera

gradients

palette

optics

motion

loop settings

seeds

Do NOT serialize Three.js runtime objects.

Serialize only declarative configuration.

47. Autosave

Implement debounced autosave.

Also maintain a recovery snapshot where practical.

Refreshing the page must not casually destroy the current project.

48. Undo / Redo

Implement editor-level undo/redo for:

parameter changes

transforms

add object

delete object

duplicate object

palette changes

gradient changes

optics changes

Avoid polluting undo history with every animation frame.

49. Recipe System

Provide an initial recipe browser.

Include:

Anemone

Petri

Nebula

Spore

Also optionally:

Plasma

Void

Aurora

Recipes must create regular editable scenes.

Do not create hidden preset-only logic.

50. Anemone Recipe

Construct from reusable primitives.

Suggested configuration:

Sphere Shell emitter

soft particles

central blob/core

radial field

curl field

optional weak vortex

violet/magenta gradient

strong bloom

subtle DOF

camera push or orbit

loop-safe pulse

The result should visually resemble a luminous organic radial explosion.

51. Petri Recipe

Suggested configuration:

Cells matter

30–100 cells

clustered distribution

weak curl

weak repulsion

shallow depth

cyan/pink palette

soft glow

grain

microscope-like camera

The user must be able to directly change Cell Count.

52. Nebula Recipe

Suggested configuration:

high soft-particle count

wide sphere / volume emitter

curl turbulence

multiple depth layers

sparse bright particle cores

cyan / blue / cream palette

heavy bloom

large haze

slow camera drift

53. Spore Recipe

Suggested configuration:

many small particles

several cluster emitters

attractor

curl

dark background

glow

optional trails

strong depth parallax

54. Recipe Acceptance Rule

The app must not have separate rendering implementations named:

renderAnemone()
renderPetri()
renderNebula()
renderSpore()


Instead, recipes configure reusable engine systems.

This is a hard architectural rule.

55. Export

The app must produce usable visual assets.

Support:

PNG still

WebM

GIF

PNG sequence

Support MP4 only if browser/runtime codec support is reliable.

Do not fake MP4 export with an unusable placeholder.

56. Export Controls

Provide:

Width

Height

Aspect Ratio

FPS

Duration

Format

Quality

Loop

Transparent Background where supported

FPS:

24

30

60

57. Resolution Presets

Include:

512 × 512

720 × 720

1080 × 1080

1920 × 1080

1080 × 1920

2560 × 1440

3840 × 2160

Also support custom resolution within safe limits.

58. Offline / Fixed-Step Export

Do not rely only on realtime MediaRecorder capture.

Build an export path where frames are rendered at deterministic time values.

Concept:

frame 0
time = 0 / fps

frame 1
time = 1 / fps

frame 2
time = 2 / fps


Then render and encode each frame.

At minimum, PNG sequence export should use this deterministic path.

59. Export Progress

Show:

Current Frame

Total Frames

Percentage

Cancel

Example:

Rendering 187 / 480
39%


60. Seamless Loop Export

When loop mode is enabled, export exactly complete loop cycles.

The final visual frame should transition cleanly to the first.

Do not duplicate the first frame unnecessarily at the end.

61. Seed System

Expose procedural seeds.

At least:

Scene Seed

Emitter Seed

Noise Seed

Field Seed

Randomize buttons should generate new seed values.

The same seed and project settings should reproduce the same initial procedural configuration where feasible.

62. UI Design Language

Use a dark near-black workspace.

Visual language:

restrained,

cinematic,

scientific,

futuristic,

professional.

Accent colors can derive from the currently active palette.

Avoid rainbow UI chrome.

Panels should use subtle hierarchy rather than giant borders.

Controls should be compact.

Use:

clear labels,

numeric inputs,

sliders,

dropdowns,

toggle buttons,

compact icon buttons.

Do not make the application look like a generic template.

63. Gradient Editor UX

The gradient editor deserves special visual attention.

It should look and behave like a serious creative-tool gradient editor.

Provide:

┌──────────────────────────────┐
│      GRADIENT PREVIEW        │
│ ●────●────────●─────────●     │
└──────────────────────────────┘


Stops should be draggable.

Selecting a stop opens:

color

opacity

exact position

Double-clicking the gradient may add a stop if convenient.

64. Inspector UX

Use collapsible sections.

For example when a particle system is selected:

TRANSFORM
POPULATION
APPEARANCE
MOTION
FIELDS
COLOR


When Camera is selected:

TRANSFORM
LENS
FOCUS
MOTION


Global scene inspector:

COLOR
OPTICS
LOOP
ENVIRONMENT


Do not show irrelevant controls.

65. Real-Time Interaction

Slider changes should update the render smoothly.

Do not create noticeable React layout work for every frame.

For high-frequency realtime controls, update renderer uniforms efficiently.

Use debounced rebuilds for expensive structural changes like particle count.

66. Structural Rebuild UX

If changing a value requires GPU resource rebuild, handle it gracefully.

Example:

Particle Count: 128K


On change:

debounce briefly,

rebuild particle resources,

preserve other state,

show subtle temporary rebuilding indicator if needed.

Do not reload the page.

67. Initial Default Scene

When the app opens for the first time, do not show an empty black screen.

Load a beautiful editable default scene.

Prefer Nebula.

It should immediately demonstrate:

particles,

3D depth,

curl movement,

strong gradient,

bloom,

camera drift.

The scene must already feel alive.

68. Empty Scene Support

Users should still be able to create a genuinely empty scene.

New Project options:

Empty Scene

Nebula

Anemone

Petri

Spore

69. Performance Guardrails

Do not create unnecessary React state updates every animation frame.

Do not read particle state back to CPU each frame.

Do not allocate large arrays every frame.

Do not recreate shader materials every frame.

Do not recreate render targets every frame.

Dispose GPU resources explicitly.

70. Capability Detection

At startup detect whether WebGL2 is available.

If required GPU features are missing, show a clear compatibility message.

Do not leave the user with a blank canvas.

71. Error Handling

Create visible but unobtrusive error reporting for renderer failures.

A rendering failure must not destroy saved project data.

Wrap major UI areas in error boundaries.

72. Scope Boundaries

Do NOT build in this iteration:

full node editor

Blender-like modeling

keyframe-heavy timeline

general GLSL IDE

Navier-Stokes fluid editor

full physics engine

collaboration backend

authentication

Supabase

AI generation

plugin marketplace

skeletal animation

full video editor

WebGPU-only implementation

WebGL2 is the baseline.

73. Development Order

Build the application in controlled phases.

Phase 1: Editor Shell

Implement:

workspace

canvas

outliner

inspector

Zustand state

project model

camera

basic persistence

Ensure the application is fully visible and usable before proceeding.

Phase 2: Matter and Fields

Implement:

emitter

particle system

soft particles

radial field

vortex

attractor

repulsor

curl/turbulence

Verify each control visibly affects the scene.

Phase 3: Cells / Blobs

Implement:

cells

clustered distribution

blob visual style

semantic controls

Create the Petri recipe.

Phase 4: Color Engine

Implement:

multi-stop gradient editor

gradient LUT

interpolation

mapping sources

dual gradients

color roles

palettes

Do not proceed until gradient editing is genuinely functional.

Phase 5: Optics

Implement:

bloom

DOF

tone

chromatic aberration

grain

vignette

haze

Focus heavily on visual polish.

Phase 6: Motion and Looping

Implement:

global loop clock

LFO modulation

camera motion

loop-safe animation

Phase 7: Recipes

Build:

Anemone

Petri

Nebula

Spore

using only existing reusable primitives.

If a recipe requires a new primitive, add the primitive cleanly rather than hardcoding the preset.

Phase 8: Export

Implement:

PNG

WebM

GIF

PNG sequence

fixed-step export path

export progress UI

Phase 9: Stability

Run:

TypeScript checks

linting if configured

production build

runtime verification

Fix actual issues before finishing.

74. Required Architecture Files

Create or maintain clear internal modules.

Suggested structure:

src/
  domain/
    scene/
    project/
    recipes/
    parameters/

  engine/
    core/
    simulation/
    emitters/
    matter/
    fields/
    color/
    optics/
    motion/
    export/

  state/

  persistence/

  ui/
    workspace/
    outliner/
    inspector/
    gradient-editor/
    optics/
    motion/
    export/
    diagnostics/

  shaders/
    simulation/
    matter/
    post/
    shared/

  recipes/


Avoid giant components.

Avoid giant shader files containing unrelated systems.

75. Code Quality

Use strong TypeScript typing.

Avoid any unless absolutely unavoidable.

Keep domain configuration separate from runtime renderer objects.

Maintain clear ownership of GPU resources.

Functions and modules should have focused responsibilities.

Do not leave temporary placeholder implementations behind while claiming a feature is complete.

76. Visual Quality Requirement

This project is fundamentally visual.

Do not consider a subsystem complete merely because the controls technically work.

The result must look compelling.

In particular:

soft particles must actually feel soft,

bloom must have broad luminous character,

gradients must be rich,

motion must feel smooth and organic,

depth must be visible,

camera motion must feel intentional,

Petri cells must feel biological,

Anemone must feel radial and alive,

Nebula must feel layered and atmospheric.

Prioritize visual output quality.

77. Critical Product Test

At the end, verify that one reusable engine can produce all of these:

Nebula

deep luminous particle cloud

Anemone

radial glowing organism / explosion

Petri

soft clustered cells

Spore

floating particulate biological field

without introducing four independent hardcoded rendering engines.

78. Critical Editing Test

Open the Anemone recipe.

The user must be able to:

select its emitter,

change emitter radius,

change particle count,

move the radial field,

disable the curl field,

change the camera position,

change camera motion,

edit the purple gradient into a three-stop cyan/gold gradient,

reduce bloom,

change DOF,

change loop duration,

export the result.

If those edits are not possible, the application is not sufficiently editor-like.

79. Critical Color Test

Open any recipe.

The user must be able to create a custom gradient such as:

0.00  #04141f
0.32  #00c8d8
0.71  #ffd0cf
1.00  #fff8df


Then:

move stops,

change stop opacity,

add another stop,

reverse the gradient,

change interpolation,

map it by depth or energy.

All changes must be visible in the renderer.

80. Critical Optics Test

The user must be able to transform the same scene from:

sharp / low glow / high contrast


into:

soft / dreamy / large bloom / atmospheric


without changing the underlying simulation.

This proves that simulation and finishing are properly separated.

81. Critical Persistence Test

Create a custom scene.

Change:

particle count,

camera,

fields,

gradients,

optics,

loop duration.

Reload the browser.

The scene must restore correctly.

82. Critical Export Test

Create an 8-second loop.

Export it at 30 FPS.

The export system should produce the correct number of frames or encoded duration and maintain stable deterministic timing.

83. Final Product Standard

Do not optimize for the number of features.

Optimize for:

editability,

coherence,

realtime feel,

visual quality,

architecture,

stability.

Matter Field should feel like the beginning of a serious procedural motion instrument.

It should not feel like a one-off experiment.

Build it as a system that can grow.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/af4f1f93-c656-4c13-8991-d47e9a5d56db).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
