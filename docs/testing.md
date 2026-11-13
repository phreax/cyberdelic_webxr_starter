# Testing your experience

## 1. Unit tests (no browser)

```sh
npm test          # Vitest + Riteway, pure logic (lifecycle, XR mode, theme, controls, haptics)
npm run check     # typecheck + tests
npm run build     # production bundle; also validates every public/ui/*.uikitml
```

## 2. In the emulator and on Quest

See [getting-started.md](getting-started.md).

## 3. Contract tests you get for free

- `src/demos/registry.test.ts`: every demo has a unique id, a valid scene that places the
  Demos picker, and the picker has room for it.
- `src/demos/scene-creator/center-controls.test.ts`: every `center.ts` has its controls in
  `snake-params.uikitml`.
- `shaders.test.ts` in each demo: GLSL compiles the way three.js wraps it (needs
  `glslangValidator`, otherwise skipped).

## Manual checklist

- [ ] Desktop: orb animates, panel readable, tabs switch, sliders/knob/toggle respond to the mouse.
- [ ] Emulated VR: dark background; controller ray hovers/presses controls; orb grab + two-hand scale.
- [ ] Emulated MR: passthrough (transparent background), same interactions.
- [ ] Quest: hand pinch operates the panel; haptics on click, slider release, grab and release.
- [ ] Menu: drag the bar under the panel to move it; panel keeps facing you.
- [ ] Menu: Hide button, M (desktop), left Menu or Y button, and touching the wrist button (hands) hide/show it; it reappears in front of you in XR.
- [ ] Audio tab: Demo beat drives growth (bass), flow (mid), glow (high) and beat pulse; meters + spectrum move.
- [ ] Audio tab: Mic asks permission; denying shows a red status and the scene keeps running.
- [ ] Audio tab: Capture on desktop Chrome (share a tab with audio); shows *unsupported* on Quest.
- [ ] Reactivity 0: sculpture looks the same with and without audio.
- [ ] Presets: each eases in and is highlighted; changing a control clears the highlight.
- [ ] OSC (optional): `npm run osc-bridge`, enable `osc: true`, bind an address, send from a tool.
- [ ] Garden (?example=garden): moving a hand leaves currents that persist and fade (Field memory); pinch draws particles in; touching one of the four rings (Ember, Cyberdelic, Ethereal Garden, Rainbow) fades the particles to that palette; Demo beat bursts; console shows no fallback message on Quest.
- [ ] Snake (?example=snake): smooth shading (no facets); demo loop crawls endlessly; Square + twist on a loop has no seam or jump.
- [ ] Snake list: + Add snake → edit mode with Draw; draw a stroke (trigger / pinch, not while pointing at a window); Done; select rows; Delete selects a neighbour.
- [ ] Snake edit: only curve + vertices visible; Move tool drags vertices; Closed loop toggle works even for two-point paths; Add / Delete point.
- [ ] Snake settings: changes apply only to the selected snake; Background off = see-through gaps, on = offset gradient colour with brightness; iridescence and gloss visible.
- [ ] Snake look: Tube / Spheres body (plus any plug-in bodies) (density + size); roughness and metallic clearly change the highlights; Iridescence shows rainbow diffraction along the body; no frosted edge sheen at grazing angles; gradient repeats without a seam; Hilbert tiles have no seams; black background by default, Transparent cuts the gaps; B deletes the selected vertex.
- [ ] Snake objects: grab to move / rotate, two hands to resize uniformly; grabbing selects the snake.
- [ ] Magic Cubes (?example=cubes): Mode / Kaleidoscope / Color mode / Color offset / Glow / palettes apply.
- [ ] Raymarched demos (cubes, chrome): both hands zoom + rotate; right hand moves + rotates; left hand drags a parameter; 72 FPS on Quest 3S at Medium.
- [ ] Meta Chrome (?example=chrome): Manipulate on → pinches pull the surface.
- [ ] Scene Creator (?example=scene): choose, change, hide and remove the Center Object; it comes back after a reload.
- [ ] Session page: Patterned hands / Patterned room toggles show their sliders and change the look.
- [ ] Wrist button (hands): poking it hides/shows the menus; pinching elsewhere never does.
- [ ] Demos row: switching between all demos works on desktop and inside an XR session (no exit), and back again without duplicated behaviour (e.g. single haptic pulse on grab).
- [ ] Settings persist per demo after a reload (sculpture / garden parameters, garden mood, all snakes with paths, looks and placement); Reset settings (session section) restores defaults in place.
- [ ] Quest 3S: stable 72 FPS (see docs/performance.md).
