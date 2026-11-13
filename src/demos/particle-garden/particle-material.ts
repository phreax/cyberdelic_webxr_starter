import { AdditiveBlending, ShaderMaterial, Vector4, type DataTexture } from '@iwsdk/core';
import { SIMPLEX_3D_GLSL } from '../../shaders/noise/simplex3d.glsl.js';
import { createDepthOcclusionUniforms, DEPTH_OCCLUSION_GLSL } from '../../shaders/depth-occlusion.js';
import vertexSource from './garden.vert.glsl?raw';
import fragmentSource from './garden.frag.glsl?raw';
const VERTEX_SHADER = vertexSource.replace('__SIMPLEX_3D_GLSL__', SIMPLEX_3D_GLSL);
const FRAGMENT_SHADER = fragmentSource.replace('__DEPTH_OCCLUSION_GLSL__', DEPTH_OCCLUSION_GLSL);

/**
 * Stateless GPU particle flow: each particle's position is a pure function of its home, seeds,
 * time and the hand uniforms — no simulation buffers, one draw call.
 *   home + upward drift (wrapped) + noise flow (turbulence) + beat burst + hand attract/repel
 */
export const createGardenUniforms = () => ({
  uTime: { value: 0 },
  uTurbulence: { value: 0.12 },
  uSize: { value: 1 },
  uSparkle: { value: 0 },
  uBurst: { value: 0 },
  uHandRadius: { value: 0.3 },
  /** xyz = hand position, w = +1 attract, -1 repel, 0 = no hand. */
  uHands: { value: [new Vector4(), new Vector4()] },
  /** Mood cross-fade: two baked palettes (see garden-palette.ts) and the mix between them. */
  uPaletteFrom: { value: null as DataTexture | null },
  uPaletteTo: { value: null as DataTexture | null },
  uMoodMix: { value: 1 },
  uCenter: { value: [0, 1.3, -1.2] as [number, number, number] },
  uHeight: { value: 1.2 },
  /** Half the render target height in pixels (per eye in XR), for physically sized points. */
  uViewportHalfHeight: { value: 540 },
});

export type GardenUniforms = ReturnType<typeof createGardenUniforms>;

export const createGardenMaterial = (uniforms: GardenUniforms = createGardenUniforms()): ShaderMaterial =>
  new ShaderMaterial({
    name: 'particle-garden',
    uniforms: { ...uniforms, ...createDepthOcclusionUniforms() },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });
