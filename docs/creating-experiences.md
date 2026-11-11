# Create a new experience (~15 minutes)

An experience is an object with `init(ctx)`, `update(dt)` and `dispose()`. `ctx` gives you the native
IWSDK `world` (scene, camera, renderer, input) plus `params`, `audio`, `osc`, `haptics`, `theme`,
`xr.enter()` and `track()` for cleanup. You never edit `src/core/` or `src/components/`.

## 1. Run the reference

```sh
npm install && npm run dev
```

The Reactive Sculpture (`src/examples/reactive-sculpture/`) is the full reference: params, audio,
presets, spatial panel, grab/scale, haptics, VR/MR.

## 2. Make your object

Static geometry lives in a scene asset (side-effect free; evaluated by runtime *and* editor):

```ts
// src/scene-assets/my-thing.scene-asset.ts
import { Group, Mesh, ShaderMaterial, TorusKnotGeometry } from '@iwsdk/core';
export function createMyThing(): Group {
  const material = new ShaderMaterial({
    name: 'my-thing',
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0.5 } },
    vertexShader: `uniform float uTime; uniform float uAmount;
      void main() { vec3 p = position + normal * sin(position.y * 20.0 + uTime) * 0.02 * uAmount;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `void main() {
      gl_FragColor = vec4(0.0, 0.85, 0.78, 1.0);
      #include <colorspace_fragment>
    }`,
  });
  const root = new Group();
  root.add(new Mesh(new TorusKnotGeometry(0.15, 0.04, 200, 24), material));
  return root;
}
```

Register it in `src/assets.ts` (`'my-thing': createMyThing()`) and place it in
`public/scenes/main.iwsdk.scene.json`:

```json
{ "id": "my-thing", "name": "My Thing", "content": { "type": "asset", "asset": "my-thing" },
  "transform": { "position": [0, 1.4, -1] } }
```

Reusable GLSL: `src/shaders/noise/` (simplex, fbm), `src/shaders/color/palette.glsl.ts`.

## 3. Write the experience

```ts
// src/examples/my-experience/my-experience.ts
import { Mesh, ShaderMaterial } from '@iwsdk/core';
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
      material.uniforms.uAmount.value = params.get('amount');
    },
    dispose() { material = undefined; },
  };
};
```

## 4. Run it

```ts
// src/index.ts
scene: createMyExperience(),
```

Then `npm run check` (typecheck + tests) and look at it in IWER / on Quest (see `docs/testing.md`).

## 5. Add controls (optional)

Copy `public/ui/control-panel.uikitml`, keep the element ids you need, and bind them:
`bindSlider(panel, 'amount', { ...controlOptions(params, 'amount'), step: 0.01 })` + `bindUI(params, 'amount', slider)`.
Move/hide behaviour comes from `createPanelMenu(ctx, { nodeId })`.
