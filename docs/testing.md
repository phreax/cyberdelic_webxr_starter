# Testing your experience

## 1. Unit tests (no browser)

```sh
npm test          # Vitest + Riteway, pure logic (lifecycle, XR mode, theme, controls, haptics)
npm run check     # typecheck + tests
npm run build     # production bundle; also validates every public/ui/*.uikitml
```

## 2. Desktop with XR emulation (IWER)

```sh
npm run dev
```

Opens the managed IWSDK browser at `https://localhost:8081` with **IWER**, IWSDK's
browser XR emulator (emulates a Quest 3 in a living room). You get:

- **Desktop preview**: mouse clicks the control panel (canvas pointer events).
- **Emulated XR**: click *Session → Enter VR / Enter MR* on the panel, then use the
  IWER controls to move the head, controllers and hands
  ([IWER controls](https://iwsdk.dev/guides/02-testing-experience.html#iwer-controls)).

> **macOS 13 note:** the managed browser uses Playwright's Chromium, which no longer
> runs on macOS 13 (Ventura). Use `npm run dev:runtime` (plain Vite with the IWSDK
> plugin) and open `https://localhost:8081` in your own Chrome instead (not yet verified),
> or upgrade macOS.

## 3. On Quest 3 / 3S

1. Put the computer and headset on the same Wi-Fi.
2. `npm run dev` (or `npm run dev:runtime`), then `npm run dev:status` and pick a URL from `runtimeUrls.network`.
3. Open it in Quest Browser and accept the local certificate warning (WebXR needs HTTPS).
4. Use the panel: *Enter VR* / *Enter MR*. Grab the orb with squeeze or pinch; use a second hand to scale.

USB alternative: `adb reverse tcp:8081 tcp:8081` and open `https://localhost:8081`.

Performance check: target **72 FPS on Quest 3S**. Use the Meta Quest Developer Hub
performance HUD or OVR Metrics Tool while the orb animates.

## Manual checklist

- [ ] Desktop: orb animates, panel readable, tabs switch, sliders/knob/toggle respond to the mouse.
- [ ] Emulated VR: dark background; controller ray hovers/presses controls; orb grab + two-hand scale.
- [ ] Emulated MR: passthrough (transparent background), same interactions.
- [ ] Quest: hand pinch operates the panel; haptics on click, slider release, grab and release.
- [ ] Menu: drag the bar under the panel to move it; panel keeps facing you.
- [ ] Menu: Hide button, M (desktop), left controller Menu button and wrist button (hands) hide/show it; it reappears in front of you in XR.
- [ ] Audio tab: Demo beat drives growth (bass), flow (mid), glow (high) and beat pulse; meters + spectrum move.
- [ ] Audio tab: Mic asks permission; denying shows a red status and the scene keeps running.
- [ ] Audio tab: Capture on desktop Chrome (share a tab with audio); shows *unsupported* on Quest.
- [ ] Reactivity 0: sculpture looks the same with and without audio.
- [ ] Presets: each eases in and is highlighted; changing a control clears the highlight.
- [ ] OSC (optional): `npm run osc-bridge`, enable `osc: true`, bind an address, send from a tool.
- [ ] Quest 3S: stable 72 FPS (see docs/performance.md).
