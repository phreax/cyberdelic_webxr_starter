# Component reference

Open the **Developer Playground** to try everything: `https://localhost:8081/?example=playground`.

## Examples

`?example=sculpture` (default) · `?example=garden` · `?example=snake` · `?example=playground`. Register new ones in `src/examples/registry.ts`
(each can load its own scene with `level`).

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
| Toolbar | markup `public/ui/toolbar.uikitml` + `bindButton` per tool | |
| StatusIndicator | `bindStatus(source, { dot, text })` → `set(level, text)` | dot + text |

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

## Audio (`src/components/audio/`)

`ctx.audio` (see docs/audio.md) · `ctx.sounds.play('click' | 'select' | 'grab' | 'release')` ·
`createSpatialSound(ctx, object, { url } | { node })` · `createAmbientSound(ctx, { url })`.

## OSC (`src/components/osc/`)

`ctx.osc` (see docs/osc.md) · `createOscMonitor()` + `osc.onAny()` for a live monitor (Playground → OSC tab).
