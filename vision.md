# Vision — Cyberdelic XR Starter Kit

> Source of truth for agents and contributors. Derived from
> [`cyberdelic-webxr-starter-prd.md`](./cyberdelic-webxr-starter-prd.md) (v0.1 MVP).
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
5. OSC in/out via a Node UDP ↔ WebSocket bridge.
6. Simple custom GLSL shaders and generative visuals.
7. Desktop development without a headset (IWER emulation).
8. Stable **72 FPS on Quest 3S** for the reference scene.
9. Approachable codebase for contributors of mixed experience.

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
| Package manager | npm (+ workspaces) | PRD onboarding is `npm install`. |
| Repo layout | Single root app/library + `apps/osc-bridge` workspace | Split packages only on demonstrated need. |

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
PRD §13 folders beside them.

```text
iwsdk.config.json          IWSDK project authority (scene, features, XR mode)
src/index.ts               World.create() + system registration
src/assets.ts              asset manifest (side-effect free, two realms)
src/components.ts          defineComponents() manifest for editor + runtime
src/scene-assets/          procedural Object3D prototypes
src/core/{xr,parameters,events}/
src/components/{ui,interaction,audio,osc,visuals}/
src/shaders/{noise,sdf,effects}/
src/themes/  src/examples/  src/utils/
public/{scenes,ui,models,textures,audio}/
apps/osc-bridge/           Node OSC UDP ↔ WebSocket bridge (Phase 3)
tasks/                     aidd epics; plan.md indexes them
```

No barrel `index.ts` files (IWSDK convention). Tests are colocated (`*.test.ts`).

## Success criteria

The 15 acceptance criteria in PRD §15, notably: runs in Quest Browser; desktop
emulation; VR + passthrough MR; readable interactive UI via controllers and hands;
grab/rotate/scale; haptics; audio and OSC drive the same parameters as UI; custom
GLSL with minimal boilerplate; 72 FPS on Quest 3S; new experience without touching
framework internals; new contributor productive in ~15 minutes.

## Open questions

- Minimum IWSDK version policy (currently pinned `1.1.0-rc.2` — a release candidate).
- Whether to keep `@meta-quest/metavr` (dev-only device CLI; collects usage data).
- Hosting target for production deploys (static HTTPS host TBD).
