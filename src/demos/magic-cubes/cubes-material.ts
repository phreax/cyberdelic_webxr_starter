// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import type { DataTexture } from '@iwsdk/core';
import { BOUNDED_SPHERE_RAY_GLSL, createBoundedSphereMaterial } from '../../shaders/raymarch/bounded-sphere.js';
import fragmentSource from './cubes.frag.glsl?raw';

/**
 * Magic Cubes: phreax/jiagual (shadertoy.com/view/MfGBRD, CC BY-NC-SA) via shader-lab (Karleido),
 * raymarched inside a bounding sphere. Removed: all audio reactivity, media input, vignette and the
 * long camera dolly (cubes and rings now oscillate around the centre). Cheaper subsurface (3 steps)
 * and AO (3 taps). `base_color` is declared by the module but unused by its shader, so it isn't ported.
 */
export const CUBES_SCALE = 11; // cube-scene units per object-space unit
export const CUBES_QUALITY_STEPS = [48, 72, 110] as const;

export const createCubesUniforms = () => ({
  uTime: { value: 0 },
  uKaleidoscope: { value: 0 },
  uMode: { value: 2 }, // 0 Cube, 1 Rings, 2 Both
  uColorMode: { value: 0 }, // 0 Dual, 1 Gradient, 2 Alternate
  uColorOffset: { value: 0 },
  uGlow: { value: 0 },
  uSteps: { value: CUBES_QUALITY_STEPS[1] as number },
  uPalette: { value: null as DataTexture | null },
});
export type CubesUniforms = ReturnType<typeof createCubesUniforms>;

const FRAGMENT = fragmentSource.replace('__BOUNDED_SPHERE_RAY_GLSL__', BOUNDED_SPHERE_RAY_GLSL).replace('__CUBES_SCALE_TOFIXED_1__', CUBES_SCALE.toFixed(1));

export const createCubesMaterial = (uniforms: CubesUniforms = createCubesUniforms()) => createBoundedSphereMaterial('magic-cubes', uniforms, FRAGMENT, 1.5);
