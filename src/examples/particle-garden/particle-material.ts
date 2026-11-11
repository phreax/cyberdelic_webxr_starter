import { AdditiveBlending, ShaderMaterial, Vector4, type DataTexture } from '@iwsdk/core';
import { SIMPLEX_3D_GLSL } from '../../shaders/noise/simplex3d.glsl.js';

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
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uSize;
      uniform float uSparkle;
      uniform float uBurst;
      uniform float uHandRadius;
      uniform vec4 uHands[2];
      uniform vec3 uCenter;
      uniform float uHeight;
      uniform float uViewportHalfHeight;
      varying float vMix;
      varying float vGlow;
      ${SIMPLEX_3D_GLSL}

      vec3 handOffset(vec3 p, vec4 hand) {
        if (hand.w == 0.0) return vec3(0.0);
        vec3 toHand = hand.xyz - p;
        float d = length(toHand);
        float f = 1.0 - smoothstep(0.0, uHandRadius, d); // mirrors garden-math.ts handForce()
        vec3 dir = toHand / max(d, 1e-4);
        // attract: pull most of the way in (not past the hand); repel: push out to the radius edge
        return hand.w > 0.0 ? dir * f * d * 0.85 : -dir * f * (uHandRadius - d) * 0.9;
      }

      void main() {
        vec3 p = position;
        float t = uTime * (0.4 + aSeed.x * 0.6);
        // slow upward drift, wrapped inside the garden height
        p.y = uCenter.y - uHeight * 0.5 + mod(p.y - (uCenter.y - uHeight * 0.5) + t * 0.05 * (0.3 + aSeed.y), uHeight);
        // organic flow
        vec3 q = p * 1.4 + vec3(0.0, uTime * 0.12, 0.0);
        vec3 flow = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.1));
        p += flow * uTurbulence;
        // beat burst: radial push from the garden centre
        p += normalize(p - uCenter + 1e-4) * uBurst * 0.12 * aSeed.z;
        // hands
        float near = 0.0;
        for (int i = 0; i < 2; i++) {
          vec3 o = handOffset(p, uHands[i]);
          near = max(near, length(o));
          p += o;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vMix = fract(aSeed.w + uTime * 0.02);
        float twinkle = step(0.92 - uSparkle * 0.3, fract(aSeed.y * 13.7 + uTime * (1.0 + aSeed.x * 3.0)));
        vGlow = 0.55 + twinkle * uSparkle * 1.6 + near * 4.0;
        // world size in metres (6..14 mm) → pixels at this depth
        float worldSize = uSize * (0.006 + aSeed.z * 0.008) * (1.0 + twinkle * uSparkle);
        gl_PointSize = min(worldSize * projectionMatrix[1][1] * uViewportHalfHeight / max(-mv.z, 0.05), 64.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPaletteFrom;
      uniform sampler2D uPaletteTo;
      uniform float uMoodMix;
      varying float vMix;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c));
        if (a <= 0.01) discard;
        vec2 paletteUv = vec2(vMix, 0.5);
        vec3 color = mix(texture2D(uPaletteFrom, paletteUv).rgb, texture2D(uPaletteTo, paletteUv).rgb, uMoodMix) * vGlow;
        gl_FragColor = vec4(color * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
