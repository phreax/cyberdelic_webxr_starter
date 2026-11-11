import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
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

/**
 * GPU particle simulation for the Particle Garden: position + velocity live in float textures
 * (ping-pong). Particles are pushed by noise flow (turbulence), dragged toward the hand-stirred
 * flow field (stir), pulled by pinching hands, gently sprung to their home so the garden keeps its
 * shape, and respawned after their lifetime.
 */
export const SIM_SIZE = 128;
export const SIM_PARTICLES = SIM_SIZE * SIM_SIZE;

const VELOCITY_SHADER = /* glsl */ `
precision highp sampler3D;
uniform float uTime;
uniform float uDt;
uniform float uTurbulence;
uniform float uStir;
uniform float uBurst;
uniform float uHandRadius;
uniform vec4 uHands[2];
uniform vec3 uCenter;
uniform sampler3D uField;
uniform vec3 uFieldMin;
uniform vec3 uFieldSize;
uniform sampler2D uHome;
${SIMPLEX_3D_GLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(texturePosition, uv);
  vec4 v = texture2D(textureVelocity, uv);
  vec3 home = texture2D(uHome, uv).xyz;
  vec3 q = p.xyz * 1.3 + vec3(0.0, uTime * 0.15, uTime * 0.05);
  vec3 flow = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.1));
  vec3 field = texture(uField, (p.xyz - uFieldMin) / uFieldSize).xyz;
  vec3 acc = flow * uTurbulence * 2.0;
  // Drag toward the stirred field velocity: particles ride the currents your hands make.
  acc += (field - v.xyz) * uStir * length(field) * 4.0;
  acc += (home - p.xyz) * 0.25;
  for (int i = 0; i < 2; i++) {
    vec4 hand = uHands[i];
    if (hand.w <= 0.0) continue; // only pinching hands attract; open hands act through the field
    vec3 toHand = hand.xyz - p.xyz;
    float d = length(toHand);
    float f = 1.0 - smoothstep(0.0, uHandRadius * 2.0, d);
    acc += toHand / max(d, 0.02) * f * 3.0;
  }
  acc += normalize(p.xyz - uCenter + 1e-4) * uBurst * 4.0;
  v.xyz += acc * uDt;
  v.xyz *= exp(-1.8 * uDt);
  gl_FragColor = v;
}
`;

const POSITION_SHADER = /* glsl */ `
uniform float uDt;
uniform sampler2D uHome;
uniform vec3 uCenter;
uniform vec3 uRadius;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(texturePosition, uv);
  vec4 v = texture2D(textureVelocity, uv);
  vec4 home = texture2D(uHome, uv); // w = lifetime (s)
  p.xyz += v.xyz * uDt;
  p.w += uDt;
  vec3 e = (p.xyz - uCenter) / (uRadius * 1.6);
  if (p.w > home.w || dot(e, e) > 1.0) p = vec4(home.xyz, 0.0);
  gl_FragColor = p;
}
`;

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
    uColorA: { value: new Color('#00D9C7') },
    uColorB: { value: new Color('#2E7BFF') },
    uViewportHalfHeight: { value: 540 },
  };
  const material = new ShaderMaterial({
    name: 'particle-garden-sim',
    uniforms: renderUniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec2 aRef;
      attribute vec4 aSeed;
      uniform sampler2D uPositions;
      uniform sampler2D uVelocities;
      uniform float uTime;
      uniform float uSize;
      uniform float uSparkle;
      uniform float uViewportHalfHeight;
      varying float vMix;
      varying float vGlow;
      void main() {
        vec4 p = texture2D(uPositions, aRef);
        vec3 v = texture2D(uVelocities, aRef).xyz;
        vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
        vMix = fract(aSeed.w + uTime * 0.02);
        float twinkle = step(0.92 - uSparkle * 0.3, fract(aSeed.y * 13.7 + uTime * (1.0 + aSeed.x * 3.0)));
        float fadeIn = smoothstep(0.0, 0.6, p.w);
        vGlow = (0.55 + twinkle * uSparkle * 1.6 + min(length(v) * 1.5, 2.0)) * fadeIn;
        float worldSize = uSize * (0.006 + aSeed.z * 0.008) * (1.0 + twinkle * uSparkle);
        gl_PointSize = min(worldSize * projectionMatrix[1][1] * uViewportHalfHeight / max(-mv.z, 0.05), 64.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vMix;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c));
        if (a <= 0.01) discard;
        vec3 color = mix(uColorA, uColorB, smoothstep(0.2, 0.8, vMix)) * vGlow;
        gl_FragColor = vec4(color * a, a);
        #include <colorspace_fragment>
      }
    `,
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
