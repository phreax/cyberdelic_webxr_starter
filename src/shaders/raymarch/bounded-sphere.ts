import { BackSide, ShaderMaterial } from '@iwsdk/core';
import { createDepthOcclusionUniforms, DEPTH_OCCLUSION_GLSL } from '../depth-occlusion.js';
import sourceBoundedSphereVertex from './bounded-sphere.vert.glsl?raw';
import sourceBoundedSphereRayGlsl from './bounded-sphere-ray.glsl?raw';

/**
 * Raymarching bounded to a sphere mesh — the shared setup for the raymarched demos
 * (Cubes, Meta Chrome, and anything you build on it):
 *
 * - Per-eye rays: the eye position comes from each view's viewMatrix. IWSDK renders with
 *   multiview, where three's `cameraPosition` is shared by both eyes (rays from one point look flat).
 * - Rays are clipped to the sphere: march only between entry and exit; misses are discarded so
 *   passthrough shows around the object.
 * - Depth comes from the raymarched hit (`boundedFragDepth`), not from the proxy sphere, so
 *   snakes, hands and panels pass in front of or behind the object correctly.
 * - Back faces are drawn so the object still renders with the head inside the sphere.
 * - `boundedSphereRay()` turns the view 180° about Y: the source shaders put their camera and
 *   lights at -z, while the viewer faces the sphere from +z.
 */
export const BOUNDED_SPHERE_VERTEX = sourceBoundedSphereVertex;

export const BOUNDED_SPHERE_RAY_GLSL = sourceBoundedSphereRayGlsl.replace('__DEPTH_OCCLUSION_GLSL__', DEPTH_OCCLUSION_GLSL);

export const createBoundedSphereMaterial = (name: string, uniforms: Record<string, { value: unknown }>, fragmentShader: string, boundsRadius = 1) =>
  new ShaderMaterial({
    name,
    uniforms: {
      ...uniforms,
      ...createDepthOcclusionUniforms(),
      uBoundsRadius: { value: boundsRadius },
    },
    vertexShader: BOUNDED_SPHERE_VERTEX,
    fragmentShader,
    side: BackSide,
    transparent: true,
    // The fragment shader writes gl_FragDepth at the raymarched surface (glow-only pixels at the far
    // side of the sphere), so writing depth makes geometry inside or behind the object sort correctly.
    depthWrite: true,
  });
