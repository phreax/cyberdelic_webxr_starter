import { Vector2 } from '@iwsdk/core';
import sourceDepthOcclusionGlsl from './depth-occlusion.glsl?raw';

// DepthSensingSystem updates these uniforms for every DepthOccludable material.
// Supplying occlusionEnabled prevents its standard-material shader injection, which
// targets the unmodified Three.js diffuseColor and does not fit our custom shaders.
export const createDepthOcclusionUniforms = () => ({
  occlusionEnabled: { value: false },
  uXRDepthTextureArray: { value: null },
  uRawValueToMeters: { value: 0.001 },
  uIsGPUDepth: { value: false },
  uDepthNear: { value: 0 },
  uViewportSize: { value: new Vector2(1, 1) },
  uOcclusionBlurRadius: { value: 20 },
  uOcclusionHardMode: { value: false },
  uOcclusionMinMaxMode: { value: false },
  uMinMaxTexture0: { value: null },
  uMinMaxTexture1: { value: null },
});

export const DEPTH_OCCLUSION_GLSL = sourceDepthOcclusionGlsl;
