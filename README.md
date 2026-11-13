# Cyberdelic XR Starter

**Make trippy, touchable VR and mixed-reality worlds in your browser.**
Glowing sculptures that breathe with your music, particle gardens you stir with your hands,
snakes you draw in the air. Open it on a Meta Quest, or right on your laptop.

<!-- Screenshot / GIF goes here -->

## What is this?

A ready-to-hack WebXR starter kit: a small framework, a library of spatial UI and interaction
components, and a handful of demos you can copy, remix and tear apart.

**Who it's for:** artists, VJs, creative coders and curious beginners. If you can edit a
JavaScript file, you can make something here. No game engine and no app store. It's just a
web page that turns into a world when you put on a headset.

## The demos

Switch between them from the floating **Demos** menu, or add `?example=<id>` to the URL.

| Demo | What it does | `?example=` |
|---|---|---|
| **Sculpture** | A glowing orb that grows, flows and pulses with sound. Grab it, scale it with two hands. | `sculpture` |
| **Garden** | Thousands of GPU particles in a flow field you stir with your hands. | `garden` |
| **Snake Creator** | Draw a path in the air and a snake crawls along it. Tune its shape, pattern and material. | `snake` |
| **Scene Creator** | Snakes plus one center object (Sculpture, Cubes or Meta Chrome), saved for next time. | `scene` |
| **Cubes** | A raymarched kaleidoscope of cubes and rings. | `cubes` |
| **Meta Chrome** | Liquid chrome blobs you can pinch and pull. | `chrome` |

More in [docs/demos.md](docs/demos.md).

## Get started (about 3 minutes)

You need [Node.js](https://nodejs.org) **22.12+** or **24+** (the LTS installer is fine).

```sh
git clone <this repo> cyberdelic-xr
cd cyberdelic-xr
npm install
npm run dev
```

`npm run dev` opens a browser window with **IWER**, a built-in XR emulator. It fakes a Quest 3
headset with controllers and hands, so you can try everything without a headset.

**On a Quest 3 / 3S:** connect it to the same Wi-Fi, run `npm run dev:status`, open one of
the `network` URLs in the Quest Browser and accept the certificate warning. Then press
**Enter VR** or **Enter MR**.

Before you share your changes:

```sh
npm run check   # typecheck + unit tests
npm run build   # production bundle in dist/
```

Stuck? See [docs/getting-started.md](docs/getting-started.md).

## Make your own demo in 5 steps

1. Copy a folder in `src/demos/` (e.g. `reactive-sculpture`) and rename it.
2. In its `demo.ts`, give it a new `id`, `title` and `order`.
3. Point it at your scene in `public/scenes/` and your panel in `public/ui/`.
4. Change the visuals. Shaders are plain GLSL files right next to the code.
5. `npm run dev`. Your demo is already in the Demos menu. No registration needed.

The full walkthrough is in [docs/make-a-demo.md](docs/make-a-demo.md).

## Stack

- **[Meta IWSDK](https://iwsdk.dev)**: WebXR framework (entity-component system, spatial UI, grabbing, hand tracking, XR emulator)
- **[Three.js](https://threejs.org)**: 3D rendering and GLSL shaders
- **TypeScript + Vite**: fast dev server with hot reload
- **Vitest + Riteway**: readable unit tests
- **OSC bridge** (optional): talk to TouchDesigner, Ableton and friends

## Project map

```text
src/
  demos/<demo>/      one folder per demo: demo.ts, assets.ts, experience, shaders, tests
  components/        reusable library: UI controls, interaction, audio, OSC, visuals
  core/              experience lifecycle, parameters, XR entry, persistence
  shaders/           shared GLSL (noise, palettes, raymarching)
public/
  scenes/            scene layouts (JSON)
  ui/                spatial panels (UIKitML)
apps/osc-bridge/     tiny Node bridge between OSC (UDP) and the browser
docs/                short guides
```

## Docs

- [Getting started & testing on Quest](docs/getting-started.md)
- [The demos](docs/demos.md)
- [Make a demo](docs/make-a-demo.md)
- [Component library](docs/components.md)
- [Audio reactivity](docs/audio.md)
- [OSC](docs/osc.md)
- [Testing](docs/testing.md)
- [Performance on Quest](docs/performance.md)

## Hacking with AI agents

This repo is set up for coding agents ([aidd](https://github.com/paralleldrive/aidd) and
IWSDK skills). They read `AGENTS.md`, then `vision.md`, then `aidd-custom/AGENTS.md`, then
`IWSDK.md`. Ask them for a new demo and they will follow the same folder conventions.

## License

The starter (framework, components, shared shaders, Sculpture, Garden) is **MIT**, see
[`LICENSE`](LICENSE). The creative demos and effects listed in
[`LICENSE-CC-BY-NC-SA.md`](LICENSE-CC-BY-NC-SA.md) (Snake Creator, Scene Creator, Cubes,
Meta Chrome, and the Patterned Vision hand/room effect) are **CC BY-NC-SA 4.0**: remix them
freely for non-commercial work, with credit.

Heads-up: Patterned Vision (which also draws the hand outlines) is part of the shared Session
page, so every demo ships it. A fully MIT build has to remove `src/components/visuals/patterned-*`
and its uses in `src/index.ts` and `src/components/ui/standard-sections.ts`.
