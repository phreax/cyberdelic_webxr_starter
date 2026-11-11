import { AdditiveBlending, Color, ShaderMaterial } from '@iwsdk/core';
import { SIMPLEX_3D_GLSL } from '../../shaders/noise/simplex3d.glsl.js';

/**
 * Placeholder "cyber orb": noise-displaced sphere with a fresnel rim, cosine palette
 * and an optional pulse. Cheap enough for Quest 3S (vertex noise only, simple fragment).
 */
export const createOrbUniforms = () => ({
  uTime: { value: 0 },
  uHue: { value: 0 },
  uDisplace: { value: 0.12 },
  uPulse: { value: 0 },
  uPrimary: { value: new Color('#00D9C7') },
  uSecondary: { value: new Color('#FF9500') },
});

export type OrbUniforms = ReturnType<typeof createOrbUniforms>;

export const createOrbMaterial = (uniforms: OrbUniforms = createOrbUniforms()): ShaderMaterial =>
  new ShaderMaterial({
    name: 'cyber-orb',
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uDisplace;
      uniform float uPulse;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vNoise;
      ${SIMPLEX_3D_GLSL}
      void main() {
        float n = snoise(normal * 1.6 + vec3(0.0, uTime * 0.35, uTime * 0.2));
        float beat = uPulse * (0.5 + 0.5 * sin(uTime * 4.0));
        vec3 displaced = position + normal * (n * uDisplace + beat * 0.04);
        vNoise = n;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHue;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vNoise;
      vec3 hueShift(vec3 color, float hue) {
        const vec3 k = vec3(0.57735);
        float c = cos(hue), s = sin(hue);
        return color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
      }
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 2.5);
        vec3 base = mix(uPrimary, uSecondary, smoothstep(-0.4, 0.8, vNoise));
        vec3 color = hueShift(base, uHue * 6.2831853) * (0.35 + 0.65 * fresnel) + fresnel * 0.35;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

/** Additive halo shell around the orb. */
export const createHaloMaterial = (uniforms: OrbUniforms): ShaderMaterial =>
  new ShaderMaterial({
    name: 'cyber-orb-halo',
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPrimary;
      uniform float uPulse;
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 3.0);
        float glow = rim * (0.25 + 0.2 * uPulse * (0.5 + 0.5 * sin(uTime * 4.0)));
        gl_FragColor = vec4(uPrimary * glow, glow);
      }
    `,
  });
