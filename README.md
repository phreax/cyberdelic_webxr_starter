# Cyberdelic XR Starter Kit

WebXR boilerplate + component library for beautiful, interactive VR/MR experiences
on Meta Quest 3/3S and desktop. Built on Meta IWSDK + Three.js + TypeScript + Vite.

- Vision: [`vision.md`](./vision.md) · PRD: [`cyberdelic-webxr-starter-prd.md`](./cyberdelic-webxr-starter-prd.md) · Roadmap: [`plan.md`](./plan.md)

## Quick start

```sh
npm install
npm run dev        # managed dev server + browser with IWER (XR emulator)
npm test           # Vitest + Riteway unit tests
npm run check      # typecheck + tests
npm run build      # production bundle in dist/
```

Requires Node `>=20.19 <21`, `>=22.12 <23`, or `>=24`.

Examples: `?example=sculpture` (default) · `?example=garden` (Particle Garden) · `?example=playground` (all components).

Docs: [components](./docs/components.md) · [testing](./docs/testing.md) · [create an experience](./docs/creating-experiences.md) · [audio](./docs/audio.md) · [OSC](./docs/osc.md) · [performance](./docs/performance.md)

**On Quest:** run `npm run dev:status`, open one of the network URLs on a headset on
the same Wi-Fi, accept the local certificate warning. See
[Testing your experience](https://iwsdk.dev/guides/02-testing-experience.html).

## AI-assisted development

This repo uses [aidd](https://github.com/paralleldrive/aidd). Agents read
`AGENTS.md` → `vision.md` → `aidd-custom/AGENTS.md` → `IWSDK.md`. Plan work with
`/task`, implement with TDD, review with `/review`.

---

## IWSDK scaffold notes

This project uses `iwsdk.config.json` for declarative scene, asset, component,
XR, and emulator configuration. Application systems remain explicit in
`src/index.ts`.

```sh
npm install
npm run dev
```

Use the Runtime and Editor controls in the managed browser to switch between
the running experience and its authored scene.

## Starter content

The robot and welcome panel are small examples of authored scene content plus
runtime systems. The robot turns toward the player's head and plays a sound
when pressed. To remove the robot, delete its scene node, its `RobotSystem`
registration from `src/index.ts` or `src/index.js`, and its `Robot` registration
from `src/components.ts` or `src/components.js`; you can then delete the unused
robot component and system files. To remove the welcome panel, delete its scene
node and its `PanelSystem` registration from the application entry point.

The robot stands on the second of three numbered stations. The first holds dark
pieces you can grab and move, and the third holds a ring you can spin in place.
The studio props (the plinths and the dark pieces, plus the floor and stage in VR
and Desktop 3D) are built in code in `src/scene-assets/studio.scene-asset.ts` or
`.js`. The VR and Desktop 3D background furniture is built the same way in
`src/scene-assets/decor.scene-asset.ts` or `.js`, so the starter downloads no
extra models. To remove any of them, delete their scene nodes and their entries
in `src/assets.ts` or `src/assets.js`, then delete the files you no longer use.
The station labels are `public/ui/label-*.uikitml`.

The rest of the look is built-in components in the scene, which you can edit in
the editor without code. The soft light on every object is the scene root's
`IBLGradient` (select the Level Root to edit it), and the soft shadows under
each object are `ContactShadow` nodes. In VR and Desktop 3D, the sky is the
scene root's `DomeGradient` (its colors, tilt and dither are also on the Level
Root), and the floor fades into it through the `DomeFade` on the floor node. AR
projects have no sky or floor, so passthrough stays visible, and a
`ShadowCatcher` node grounds the stations.

- Minimal scene walkthrough: https://iwsdk.dev/guides/01b-minimal-scene.html
- XR-enabled projects — IWER emulator controls: https://iwsdk.dev/guides/02-testing-experience.html#iwer-controls
