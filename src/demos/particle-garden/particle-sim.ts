import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Data3DTexture,
  DataTexture,
  DataUtils,
  FloatType,
  HalfFloatType,
  LinearFilter,
  Points,
  RGBAFormat,
  ShaderMaterial,
  Vector4,
  type WebGLRenderer,
} from '@iwsdk/core';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { SIMPLEX_3D_GLSL } from '../../shaders/noise/simplex3d.glsl.js';
import type { FlowField } from './flow-field.js';
import { seededRandom } from './garden-math.js';
import sourceVelocityShader from './garden-velocity.glsl?raw';
import sourcePositionShader from './garden-position.glsl?raw';
import simVertexSource from './garden-sim.vert.glsl?raw';
import simFragmentSource from './garden-sim.frag.glsl?raw';

/**
 * GPU particle simulation for the Particle Garden: position + velocity live in float textures
 * (ping-pong). Particles are pushed by noise flow (turbulence), dragged toward the hand-stirred
 * flow field (stir), pulled by pinching hands, gently sprung to their home so the garden keeps its
 * shape, and respawned after their lifetime.
 */
export const SIM_SIZE = 128;
export const SIM_PARTICLES = SIM_SIZE * SIM_SIZE;

const VELOCITY_SHADER = sourceVelocityShader.replace('__SIMPLEX_3D_GLSL__', SIMPLEX_3D_GLSL);

const POSITION_SHADER = sourcePositionShader;

export type ParticleSim = ReturnType<typeof createParticleSim>;

export const createParticleSim = (
  renderer: WebGLRenderer,
  { homes, seeds, center, radius, field }: { homes: Float32Array; seeds: Float32Array; center: readonly number[]; radius: readonly number[]; field: FlowField },
) => {
  const gl = renderer.getContext();
  const hasFloat = gl.getExtension('EXT_color_buffer_float') !== null;
  const hasHalf = hasFloat || gl.getExtension('EXT_color_buffer_half_float') !== null;
  if (!hasHalf) return { error: 'Float render targets are not supported; using stateless particles.' } as const;

  const gpu = new GPUComputationRenderer(SIM_SIZE, SIM_SIZE, renderer);
  gpu.setDataType(hasFloat ? FloatType : HalfFloatType);

  const position0 = gpu.createTexture();
  const velocity0 = gpu.createTexture();
  const homeData = new Float32Array(SIM_PARTICLES * 4);
  const random = seededRandom(11);
  for (let i = 0; i < SIM_PARTICLES; i += 1) {
    const life = 6 + seeds[i * 4]! * 8;
    for (let c = 0; c < 3; c += 1) {
      homeData[i * 4 + c] = homes[i * 3 + c]!;
      (position0.image.data as Float32Array)[i * 4 + c] = homes[i * 3 + c]!;
    }
    homeData[i * 4 + 3] = life;
    (position0.image.data as Float32Array)[i * 4 + 3] = random() * life; // staggered ages
  }
  const homeTexture = new DataTexture(homeData, SIM_SIZE, SIM_SIZE, RGBAFormat, FloatType);
  homeTexture.needsUpdate = true;

  // Hand-stirred field: half-float (linear filtering is core in WebGL2).
  const [nx, ny, nz] = field.size;
  const fieldHalf = new Uint16Array(nx * ny * nz * 4);
  const fieldTexture = new Data3DTexture(fieldHalf, nx, ny, nz);
  fieldTexture.format = RGBAFormat;
  fieldTexture.type = HalfFloatType;
  fieldTexture.magFilter = LinearFilter;
  fieldTexture.minFilter = LinearFilter;
  fieldTexture.unpackAlignment = 1;
  fieldTexture.needsUpdate = true;

  const velocity = gpu.addVariable('textureVelocity', VELOCITY_SHADER, velocity0);
  const position = gpu.addVariable('texturePosition', POSITION_SHADER, position0);
  gpu.setVariableDependencies(velocity, [position, velocity]);
  gpu.setVariableDependencies(position, [position, velocity]);
  const vu = velocity.material.uniforms;
  Object.assign(vu, {
    uTime: { value: 0 },
    uDt: { value: 0 },
    uTurbulence: { value: 0.12 },
    uStir: { value: 1 },
    uBurst: { value: 0 },
    uHandRadius: { value: 0.25 },
    uHands: { value: [new Vector4(), new Vector4()] },
    uCenter: { value: center },
    uField: { value: fieldTexture },
    uFieldMin: { value: field.min },
    uFieldSize: { value: field.max.map((v, i) => v - field.min[i]!) },
    uHome: { value: homeTexture },
  });
  const pu = position.material.uniforms;
  Object.assign(pu, { uDt: { value: 0 }, uHome: { value: homeTexture }, uCenter: { value: center }, uRadius: { value: radius } });
  const error = gpu.init();
  if (error) return { error } as const;

  // Render points: each vertex reads its particle from the position texture.
  const refs = new Float32Array(SIM_PARTICLES * 2);
  for (let i = 0; i < SIM_PARTICLES; i += 1) {
    refs[i * 2] = ((i % SIM_SIZE) + 0.5) / SIM_SIZE;
    refs[i * 2 + 1] = (Math.floor(i / SIM_SIZE) + 0.5) / SIM_SIZE;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(SIM_PARTICLES * 3), 3));
  geometry.setAttribute('aRef', new BufferAttribute(refs, 2));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds.subarray(0, SIM_PARTICLES * 4), 4));
  const renderUniforms = {
    uPositions: { value: gpu.getCurrentRenderTarget(position).texture },
    uVelocities: { value: gpu.getCurrentRenderTarget(velocity).texture },
    uTime: { value: 0 },
    uSize: { value: 1 },
    uSparkle: { value: 0 },
    uPaletteFrom: { value: null as DataTexture | null },
    uPaletteTo: { value: null as DataTexture | null },
    uMoodMix: { value: 1 },
    uViewportHalfHeight: { value: 540 },
  };
  const material = new ShaderMaterial({
    name: 'particle-garden-sim',
    uniforms: renderUniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: simVertexSource,
    fragmentShader: simFragmentSource,
  });
  const points = new Points(geometry, material);
  points.name = 'particle-garden-sim';
  points.frustumCulled = false;

  let time = 0;
  return {
    error: undefined,
    points,
    simUniforms: vu,
    renderUniforms,
    /** Advance the simulation. Runs with XR rendering disabled, then restores state. */
    step(dt: number) {
      time += dt;
      vu.uTime!.value = time;
      vu.uDt!.value = dt;
      pu.uDt!.value = dt;
      // Upload the stirred field (tiny: nx·ny·nz texels).
      for (let i = 0; i < field.data.length; i += 1) fieldHalf[i] = DataUtils.toHalfFloat(field.data[i]!);
      fieldTexture.needsUpdate = true;

      const xrEnabled = renderer.xr.enabled;
      const target = renderer.getRenderTarget();
      renderer.xr.enabled = false;
      gpu.compute();
      renderer.xr.enabled = xrEnabled;
      renderer.setRenderTarget(target);
      renderUniforms.uPositions.value = gpu.getCurrentRenderTarget(position).texture;
      renderUniforms.uVelocities.value = gpu.getCurrentRenderTarget(velocity).texture;
      renderUniforms.uTime.value = time;
    },
    dispose() {
      gpu.dispose();
      geometry.dispose();
      material.dispose();
      homeTexture.dispose();
      fieldTexture.dispose();
    },
  };
};
