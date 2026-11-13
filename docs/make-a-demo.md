# Make a demo

A demo is one folder in `src/demos/`. The app finds it by itself: there's no list to update.
Delete the folder and the demo is gone.

## Anatomy

```text
src/demos/my-demo/
  demo.ts                 menu entry + how to start it          (required)
  assets.ts               things the scene can place            (optional)
  my-demo-experience.ts   the behaviour: init / update / dispose
  my-thing.scene-asset.ts the 3D object, built in code
  my-thing.frag.glsl      shaders, next to the code that uses them
  center.ts               offer it as a Scene Creator object    (optional)
  *.test.ts               tests for the pure logic
public/scenes/my-demo.iwsdk.scene.json   where things are placed
public/ui/my-demo-panel.uikitml          the floating control panel
```

## 1. Copy a demo

```sh
cp -r src/demos/reactive-sculpture src/demos/my-demo
cp public/scenes/main.iwsdk.scene.json public/scenes/my-demo.iwsdk.scene.json
```

## 2. `demo.ts`: the menu entry

```ts
import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createMyExperience } from './my-demo-experience.js';

export default defineDemo({
  id: 'my-demo',            // → ?example=my-demo
  title: 'My Demo',         // label in the Demos menu
  order: 70,                // menu position
  panelNode: 'my-panel',    // scene node of your panel (placed next to the Demos menu)
  config: () => ({ level: sceneUrl('my-demo.iwsdk.scene.json'), audio: true, scene: createMyExperience() }),
});
```

## 3. `assets.ts`: what the scene can place

```ts
import { uikitml } from '../../core/demos/asset-helpers.js';
import { createMyThing } from './my-thing.scene-asset.js';

export default {
  'my-thing': createMyThing(),                          // a 3D object built in code
  'my-panel': uikitml('my-demo-panel.uikitml', 'My Panel'),
};
```

This file is loaded by the app **and** by the scene editor, so keep it pure: no `World`, no DOM,
no timers. Asset ids must be unique across all demos.

A scene asset is a function that returns a parentless `Object3D`:

```ts
// my-thing.scene-asset.ts
import { Group, Mesh, ShaderMaterial, TorusKnotGeometry } from '@iwsdk/core';
import fragmentShader from './my-thing.frag.glsl?raw';

export const createMyThing = () => {
  const material = new ShaderMaterial({ name: 'my-thing', uniforms: { uTime: { value: 0 } }, fragmentShader });
  const root = new Group();
  root.add(new Mesh(new TorusKnotGeometry(0.15, 0.04, 200, 24), material));
  return root;
};
```

Then place it in your scene JSON by id (scene files never contain URLs or geometry):

```json
{ "id": "my-thing", "name": "My Thing", "content": { "type": "asset", "asset": "my-thing" },
  "transform": { "position": [0, 1.4, -1] } }
```

## 4. The experience

```ts
import { Mesh, type ShaderMaterial } from '@iwsdk/core';
import { makeManipulable } from '../../components/interaction/manipulable.js';
import { bindAudio } from '../../core/parameters/bindings.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';

export const createMyExperience = (): Experience<ExperienceContext> => {
  let material: ShaderMaterial | undefined;
  let params: ExperienceContext['params'] | undefined;
  return {
    init(ctx) {
      params = ctx.params;
      params.define('amount', { default: 0.5, min: 0, max: 1, smoothing: 0.2 });
      if (ctx.audio) ctx.track(bindAudio(params, ctx.audio, 'bass', 'amount', { amount: 0.5 }));
      const entity = ctx.world.requireSceneEntity('my-thing');
      entity.object3D!.traverse((o) => { if (o instanceof Mesh) material = o.material as ShaderMaterial; });
      makeManipulable(entity); // grab, rotate, two-hand scale
    },
    update(dt) {
      if (!material || !params) return;
      material.uniforms.uTime.value += dt;
    },
    dispose() { material = undefined; },
  };
};
```

`ctx` gives you the IWSDK `world` (scene, camera, input) plus `params`, `audio`, `osc`,
`haptics`, `sounds`, `theme`, `storage` and `track()` (everything tracked is cleaned up when
the demo is switched off). Parameters are saved per demo automatically.

## 5. A control panel

Copy `public/ui/control-panel.uikitml`, keep the element ids you need, and bind them:

```ts
const panel = ctx.world.requireSceneObject<UIKitMLAsset>('my-panel');
const slider = ctx.track(bindSlider(panel, 'amount', { ...controlOptions(ctx.params, 'amount'), step: 0.01 }));
ctx.track(bindUI(ctx.params, 'amount', slider));
ctx.track(createPanelMenu(ctx, { nodeId: 'my-panel' })); // move / hide behaviour
```

All controls are listed in [components.md](components.md).

## Optional plug-ins

- **`center.ts`** offers your object in the Scene Creator. Use `defineCenterObject` and the
  `shaderCenter` helper from `src/demos/scene-creator/center-object.ts`; see
  `src/demos/magic-cubes/center.ts`. Its controls go in `public/ui/snake-params.uikitml`
  (`choose-<id>`, `setting-<id>-<key>`, `center-<id>-<key>`). A test tells you which ids
  are missing.
- **`snake-body.ts`** adds a Snake Creator body type (`defineSnakeBody` in
  `src/demos/snake-creator/body-plugin.ts`).

## Private experiments: `src/lab/`

`src/lab/<name>/` works exactly like `src/demos/`. Use it for work you don't want to publish
(scenes and panels go in `public/scenes/lab/` and `public/ui/lab/`). `node
scripts/check-public.mjs` fails if lab files would end up on a public branch.

## Check it

```sh
npm run check   # typecheck + tests (scene, panel and registry contracts included)
npm run dev
```
