// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Adapted from Meta Chrome by phreax/jiagual (2026).
import { Color, Vector3, type CubeTexture, type DataTexture } from '@iwsdk/core';
import { BOUNDED_SPHERE_RAY_GLSL, createBoundedSphereMaterial } from '../../shaders/raymarch/bounded-sphere.js';
import fragmentSource from './meta-chrome.frag.glsl?raw';
import vertexSource from './meta-chrome.vert.glsl?raw';

export const CHROME_SCALE = 1.6;
export const CHROME_BOUNDS_RADIUS = 0.76;
export const CHROME_QUALITY_STEPS = [48, 72, 110] as const;

export const createMetaChromeUniforms = () => ({
  uTime: { value: 0 },
  uGlowAmount: { value: 1 },
  uGlowColor: { value: new Color(0.192, 0.075, 0.788) },
  uExposure: { value: 1 },
  uReflectionWarmth: { value: 0.5 },
  uIridescence: { value: 0.5 },
  uPinchPoint: { value: new Vector3() },
  uPinchActive: { value: 0 },
  uRightPinchPoint: { value: new Vector3() },
  uRightPinchActive: { value: 0 },
  uSphereSize: { value: 0.2 },
  uShowSpheres: { value: 0 },
  uSminFactor: { value: 0.3 },
  uSteps: { value: CHROME_QUALITY_STEPS[1] as number },
  uPalette: { value: null as DataTexture | null },
  uEnvironment: { value: null as CubeTexture | null },
});
export type MetaChromeUniforms = ReturnType<typeof createMetaChromeUniforms>;

const FRAGMENT = fragmentSource
  .replace('__BOUNDED_SPHERE_RAY_GLSL__', BOUNDED_SPHERE_RAY_GLSL)
  .replace('__CHROME_SCALE__', CHROME_SCALE.toFixed(1));

export const createMetaChromeMaterial = (uniforms: MetaChromeUniforms = createMetaChromeUniforms()) => {
  const material = createBoundedSphereMaterial('meta-chrome', uniforms, FRAGMENT, CHROME_BOUNDS_RADIUS);
  material.vertexShader = vertexSource;
  return material;
};
