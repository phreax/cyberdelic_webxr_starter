# Component reference


Short reference for the reusable building blocks. Everything lives in `src/components/` and
`src/core/`; demos only import from there (never from each other).

## Demos and plug-ins (`src/core/demos/`)

| Helper | Use |
|---|---|
| `defineDemo({ id, title, order, panelNode, config })` | Default export of a demo's `demo.ts`; found automatically |
| `uikitml(file, name)`, `lazyModel(file, name)` | Entries for a demo's `assets.ts` |
| `defineCenterObject` / `shaderCenter` | `center.ts`: a Scene Creator object (`src/demos/scene-creator/center-object.ts`) |
| `defineSnakeBody` | `snake-body.ts`: a Snake Creator body (`src/demos/snake-creator/body-plugin.ts`) |

See [make-a-demo.md](make-a-demo.md).

## UI (`src/components/ui/`)

| Component | Binder | Element ids |
|---|---|---|
| Panel | `panelStyle(theme)` + `createPanelMenu(ctx, { nodeId })` | root `panel` |
| Button / IconButton | `bindButton(source, id, { onClick })` | `id` (put a Lucide icon inside for IconButton) |
| Slider | `bindSlider(source, id, { min, max, step, onChange })` | `id`, `id-fill`, `id-value` |
| Knob | `bindKnob(source, id, { … })` | `id`, `id-indicator`, `id-value` (give the value a fixed width) |
| Toggle | `bindToggle(source, id, { onChange })` | `id`, `id-thumb` |
| Tabs | `bindTabs(source, [{ tab, page }])` | per tab + page |
| Dropdown | `bindDropdown(source, id, { options, onChange })` | `id`, `id-label`, `id-list`, `id-option-N` |
| Label / ValueDisplay | `bindValueDisplay(source, id, format)` → `set(value)` | `id` |
| ColorPicker | `bindColorPicker(source, id, { palette, onChange })` | `id-swatch-N`, `id-hue` (+`-fill`), `id-preview` |
| PresetSelector | `bindPresetSelector(source, prefix, { params, presets })` | `prefix-<name>` |
| StatusIndicator | `bindStatus(source, { dot, text })` → `set(level, text)` | dot + text |
| Panel menu | `createPanelMenu(ctx, { nodeId })`: move bar, hide/show (Menu/Y, wrist button, `M`) | |
| Shared console | `bindSharedConsole(ctx, panel, common, menu)`: the Demos picker + Session page | |

Bind to parameters two-way with `controlOptions(params, id)` + `bindUI(params, id, control)`.

## Interaction (`src/components/interaction/`)

| Component | Helper |
|---|---|
| Grabbable (+ scale) | `makeManipulable(entity, { grab: 'near' \| 'distance', scale })` |
| Rotatable | `makeRotatable(entity)` |
| Scalable | `makeScalable(entity, { min, max })` |
| Draggable | `makeDraggable(entity, { axis, range })` |
| PinchTrigger / press | `createPinchTrigger(ctx, entity, onPress)` |
| ProximityTrigger | `createProximityTrigger(ctx, entity, { radius, onEnter, onExit })` |
| GazeTrigger | `createGazeTrigger(ctx, entity, { dwell, onTrigger, onProgress })` |
| InteractionHighlight | `createInteractionHighlight(ctx, entity, { color })` |
| HapticFeedback | `ctx.haptics.pulse(hand, { intensity, duration })`, `.play(hand, 'click' \| 'select' \| 'grab' \| 'release' \| 'impact')` |
| Surface placement (MR) | `createSurfacePlacer(ctx, entity).start()` |

## Visuals (`src/components/visuals/`)

Patterned vision: hands (and optionally the room mesh in MR) drawn with an animated pattern.
Toggle it from Demos → ⚙ Session → **Patterned hands / Patterned room**, which also shows scale,
opacity, warp, chroma and offset sliders. Code: `createPatternedHands(world)`, `PatternedRoomSystem`.

## Audio (`src/components/audio/`)

`ctx.audio` (see docs/audio.md) · `ctx.sounds.play('click' | 'select' | 'grab' | 'release')` ·
`createSpatialSound(ctx, object, { url } | { node })` · `createAmbientSound(ctx, { url })`.

## OSC (`src/components/osc/`)

`ctx.osc` (see docs/osc.md) · `createOscMonitor()` + `osc.onAny()` for a live monitor.

## Settings persistence (`src/core/persistence/`)

`createExperience` saves the parameter store per example in localStorage (`cyberdelic:v1:<example>:params`)
and restores it after `init()`. Opt out with `persist: { params: false }`. Experiences save anything
else through `ctx.storage.save(key, value)` / `ctx.storage.load(key)`; `ctx.resetSettings()` (the
**Reset settings** button in session sections) clears the example's settings and restarts it.
