import { Color, ShaderMaterial, Vector3, type CubeTexture } from '@iwsdk/core';
import { PALETTE_GLSL } from '../../shaders/color/palette.glsl.js';
import { createDepthOcclusionUniforms, DEPTH_OCCLUSION_GLSL } from '../../shaders/depth-occlusion.js';
import { FBM_GLSL } from '../../shaders/noise/fbm.glsl.js';
import vertexSource from './sculpture.vert.glsl?raw';
import fragmentSource from './sculpture.frag.glsl?raw';
const VERTEX_SHADER = vertexSource.replace('__FBM_GLSL__', FBM_GLSL);
const FRAGMENT_SHADER = fragmentSource.replace('__DEPTH_OCCLUSION_GLSL__', DEPTH_OCCLUSION_GLSL).replace('__PALETTE_GLSL__', PALETTE_GLSL);

/**
 * Reactive Sculpture shader. Vertex: twisted, flowing FBM grows the form outward; normals by
 * finite differences on the sphere (3 displacement evaluations). Fragment: lit in-shader (key +
 * hemisphere + fresnel rim + iridescent palette + glow on ridges) to avoid PBR cost on Quest 3S.
 */
export const createSculptureUniforms = () => ({
  uPhase: { value: 0 },
  uGrowth: { value: 0.45 },
  uComplexity: { value: 1.6 },
  uTwist: { value: 0.8 },
  uGlow: { value: 0.35 },
  uPulse: { value: 0 },
  /** Facing opacity; silhouette edges stay more opaque (fresnel), like glass. */
  uAlpha: { value: 1 },
  uPrimary: { value: new Color('#00D9C7') },
  uSecondary: { value: new Color('#FF9500') },
  uDeep: { value: new Color('#071514') },
  uLightDir: { value: new Vector3(-0.4, 0.8, 0.45).normalize() },
  uMaterial: { value: 1 },
  uMatcapBrightness: { value: 0.8 },
  uReflectionWarmth: { value: 0.5 },
  uIridescence: { value: 0.7 },
  uEnvironmentRotation: { value: 0 },
  uEnvironmentIntensity: { value: 1 },
  uEnvironment: { value: null as CubeTexture | null },
});

export type SculptureUniforms = ReturnType<typeof createSculptureUniforms>;

export const createSculptureMaterial = (uniforms: SculptureUniforms = createSculptureUniforms()): ShaderMaterial =>
  new ShaderMaterial({
    name: 'reactive-sculpture',
    uniforms: { ...uniforms, ...createDepthOcclusionUniforms() },
    transparent: true,
    depthWrite: false,
    defines: { FBM_OCTAVES: 2 },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });
