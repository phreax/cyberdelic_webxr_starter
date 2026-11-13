# Vision — Cyberdelic XR Starter Kit

> Source of truth for agents and contributors.
> If a task conflicts with this document, stop and ask (see `AGENTS.md`).

## Promise

**Go from creative idea to beautiful interactive XR experience with minimal friction.**

Cyberdelic XR is an open-source (MIT) WebXR boilerplate + component library for
VR/MR experiences on Meta Quest 3/3S and desktop browsers. It handles XR
infrastructure so artists, creative coders and jam participants can focus on the
experience.

## Users

- **Creative coders** — know Three.js/GLSL, want to turn sketches into XR fast.
- **Artists & designers** — want polished UI, interactions, audio-reactivity without low-level XR code.
- **Jam participants** — need to launch, tweak a visual parameter and test an interaction in **≤ 15 minutes**.

## Goals (MVP)

1. Minimal-setup VR/MR experiences (`npm install && npm run dev`).
2. Beautiful, reusable spatial UI (Cyberdelic teal/orange theme, frosted glass).
3. Standardized hand, controller and haptic interactions.
4. Audio input + analysis driving parameters (volume, bass/mid/high, spectrum, onset, beat).
5. OSC base structure (Node UDP ↔ WebSocket bridge, client, parameter binding API) — not wired into examples in the MVP.
6. Simple custom GLSL shaders and generative visuals.
7. Desktop development without a headset (IWER emulation).
8. Stable **72 FPS on Quest 3S** for the reference scene.
9. Approachable codebase for contributors of mixed experience.

## Demos

Each demo is a self-contained folder in `src/demos/` (see `docs/make-a-demo.md`):

1. **Sculpture**: organic generative sculpture; grab/rotate/scale, shader params, audio-reactive deformation, VR + MR. The reference demo.
2. **Garden**: GPU particles in a hand-stirred flow field; audio-reactive colour and movement.
3. **Snake Creator**: draw and edit a curve in space; a GPU-bent snake crawls along it (renderer after shader-lab by Karleido). Extra bodies are plug-ins (`snake-body.ts`).
4. **Scene Creator**: snakes plus one Center Object chosen from every demo's `center.ts`.
5. **Cubes** and 6. **Meta Chrome**: raymarched inside a bounding sphere (`src/shaders/raymarch/bounded-sphere.ts`) with shared hand gestures (`createObjectGestures`).

`src/lab/` holds the same kind of folders for private experiments; it never ships on the public branch.

## Non-goals (MVP)

Node editor · timeline/animation editor · multiplayer · custom physics engine ·
full gesture recognition · scene-building editor · asset marketplace.

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| XR framework | **Meta IWSDK** (`@iwsdk/core`, scaffolded via `@iwsdk/create`) | Build on existing frameworks; gives XR lifecycle, input, grab, UIKitML, IWER emulation. |
| Rendering | Three.js (super-three, **imported via `@iwsdk/core` only**) | One Three instance; direct creative access to materials/GLSL. |
| Scene & interaction model | **IWSDK's built-in ECS** (components + systems) | Reusable behaviours (`Grabbable`, `ProximityTrigger`…) map 1:1 onto components/systems. No second ECS. |
| Parameter & modulation store | **Small, framework-free TypeScript module**, pure & TDD'd | Shared by UI, OSC, audio; must be deterministic and testable in Node. |
| Spatial UI | UIKitML (`.uikitml`) + `@pmndrs/uikit` | Native to IWSDK; theme tokens mapped to real UIKit props. |
| Audio | Web Audio API | No dependency; analysis runs independently of render loop. |
| OSC | `osc-js` bridge in `apps/osc-bridge` (npm workspace) | Browsers can't receive UDP. |
| Build/dev | Vite via `iwsdk dev` CLI; `iwsdk.config.json` is project authority | Required by IWSDK tooling. |
| Tests | Vitest + Riteway (unit), Playwright/IWER (browser, later) | aidd standard. |
| Package manager | npm (+ workspaces) | Onboarding is `npm install`. |
| Licensing | MIT starter; CC BY-NC-SA 4.0 for the creative demos listed in LICENSE-CC-BY-NC-SA.md | The ported shaders are non-commercial by origin. |
| Repo layout | Single root app/library + `apps/osc-bridge` workspace | Split packages only on demonstrated need. |
| Demo modularity | One folder per demo, discovered via `demo.ts` / `assets.ts` / `center.ts` / `snake-body.ts` | Add or remove a demo without touching shared files; keeps public and private branches merge-friendly. |

**Explicitly not used:** NextJS, React, Redux/Autodux, shadcn, `@adobe/data/ecs`.
aidd skills targeting those are out of scope for this project (see `aidd-custom/AGENTS.md`).

## Constraints & non-negotiables

- **Thin wrapper.** Never hide native IWSDK / Three.js objects; `createExperience()` must expose them.
- **Modular & optional.** Audio, OSC, physics and UI work independently; no mic required for a basic scene.
- **Performance first.** No per-frame allocation in `update()`; instancing where possible; restrict fullscreen post-FX; dispose GPU resources.
- **Deterministic modulation.** When several inputs drive one parameter, the result order is defined (replace → add → multiply, triggers separate) and tested.
- **Graceful degradation.** Feature-detect MR capabilities, haptics, background blur, microphone permission.
- **Secure context.** HTTPS / WSS for Quest; document local-network setup.
- **Beautiful by default, restrained.** Readable over passthrough; no excessive glow, dense layouts, or head-locked clutter.

## UX principles

- World-space panels at comfortable distance; repositionable; large text & targets.
- Every control supports controller ray, hand ray/pinch, direct touch (where sensible) and mouse.
- Clear hover / active / disabled / selected states; soft ~180 ms ease-out transitions; optional haptics & sounds.
- All colors via theme tokens (Primary `#00D9C7`, Secondary `#FF9500`, Background `#071514`, Surface `#152322`, Text `#F1F7F5`, Muted `#9BAEAB`).

## Project structure

IWSDK-required files stay where IWSDK expects them; framework code lives in
framework folders beside them.

```text
iwsdk.config.json          IWSDK project authority (scene, features, XR mode)
src/index.ts               World.create() + system registration
src/assets.ts              shared assets + every demo's assets.ts (side-effect free, two realms)
src/components.ts          defineComponents() manifest for editor + runtime
src/demos/<demo>/          one folder per demo (demo.ts, assets.ts, *.scene-asset.ts, experience, shaders, tests)
src/lab/<demo>/            private experiments, same shape (never on the public branch)
src/core/{demos,xr,parameters,persistence}/
src/components/{ui,interaction,audio,osc,visuals}/
src/shaders/{noise,color,raymarch}/
src/themes/  src/utils/
public/{scenes,ui,models,textures}/   (lab/ subfolders are private)
apps/osc-bridge/           Node OSC UDP ↔ WebSocket bridge
```

No barrel `index.ts` files (IWSDK convention). Tests are colocated (`*.test.ts`).

## Success criteria

Notably: runs in Quest Browser; desktop
emulation; VR + passthrough MR; readable interactive UI via controllers and hands;
grab/rotate/scale; haptics; audio drives the same parameters as UI (OSC binds via the same API, unused by examples); custom
GLSL with minimal boilerplate; 72 FPS on Quest 3S; new demo without touching
framework internals or other demos; new contributor productive in ~15 minutes.

## Open questions

- Minimum IWSDK version policy (currently pinned `1.1.0-rc.2` — a release candidate).
- Whether to keep `@meta-quest/metavr` (dev-only device CLI; collects usage data).
- Hosting target for production deploys (static HTTPS host TBD).

## Decisions log

- 2026-11-11: Licensing: the starter is MIT; the creative demos listed in LICENSE-CC-BY-NC-SA.md are CC BY-NC-SA 4.0. Code ported from those sources stays inside their demo folders.
- 2026-11-11: Closed snake loops crawl endlessly (no entry/exit).
- 2026-11-11: Each demo has its own scene file, selected with `?example=<id>`.
- 2026-11-13: Demos are self-registering folder modules (`src/demos/*`, private `src/lab/*`); the public branch carries no lab files or history.
