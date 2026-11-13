# The demos

Every demo is a folder in `src/demos/`. Open one and read its `demo.ts` first: it's the
table of contents. Switch demos from the **Demos** menu (the XR session stays open) or with
`?example=<id>`.

## Sculpture (`sculpture`) · `src/demos/reactive-sculpture/`

A glowing, displaced orb. **Shape**, **Audio** and **Material** tabs; presets ease between
looks. Turn on Audio → Demo beat to see it react. Grab it, or scale it with two hands.
*Read this first:* it's the reference for parameters, audio binding, panels and grabbing.

## Garden (`garden`) · `src/demos/particle-garden/`

~16k particles simulated on the GPU in a flow field. Move your hands through them to leave
currents that slowly fade; pinch to pull particles in; touch a ring to change the mood.
*Shows:* GPU simulation (render-to-texture), hand tracking as input.

## Snake Creator (`snake`) · `src/demos/snake-creator/`

Add a snake, draw its path in the air (trigger or pinch), press Done, and it crawls along the
curve. The settings window changes body (tube / spheres), profile, twist, pattern, palette,
material and speed. Grab a snake to move it, or use two hands to resize it.
*Shows:* a shader that bends a tube along a curve texture, multi-window UI, saving state.

Extra body types are plug-ins: a `snake-body.ts` in any demo folder adds one.

## Scene Creator (`scene`) · `src/demos/scene-creator/`

Snake Creator plus one **Center Object**, picked from every demo that ships a `center.ts`
(Sculpture, Cubes and Meta Chrome). Snakes and the object are saved together.
*Shows:* plug-ins discovered from folders, placing manifest assets at runtime.

## Cubes (`cubes`) · `src/demos/magic-cubes/`

A raymarched kaleidoscope of cubes and rings, drawn inside an invisible sphere so passthrough
stays visible around it. Both hands zoom and rotate; the left hand drags Color offset.
*Shows:* raymarching on Quest (`src/shaders/raymarch/bounded-sphere.ts`), palettes.

## Meta Chrome (`chrome`) · `src/demos/meta-chrome/`

Liquid chrome metaballs reflecting a warm room. Turn on **Manipulate** and pinch to pull the
surface toward your fingertips.
*Shows:* smooth-min SDF blending, environment reflections, hand pinch as shader input.
