import { Color, ShaderMaterial, Vector3 } from '@iwsdk/core';
import { PALETTE_GLSL } from '../../shaders/color/palette.glsl.js';
import { FBM_GLSL } from '../../shaders/noise/fbm.glsl.js';

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
  uHue: { value: 0 },
  uGlow: { value: 0.35 },
  uPulse: { value: 0 },
  /** Facing opacity; silhouette edges stay more opaque (fresnel), like glass. */
  uAlpha: { value: 1 },
  uPrimary: { value: new Color('#00D9C7') },
  uSecondary: { value: new Color('#FF9500') },
  uDeep: { value: new Color('#071514') },
  uLightDir: { value: new Vector3(-0.4, 0.8, 0.45).normalize() },
});

export type SculptureUniforms = ReturnType<typeof createSculptureUniforms>;

export const createSculptureMaterial = (uniforms: SculptureUniforms = createSculptureUniforms()): ShaderMaterial =>
  new ShaderMaterial({
    name: 'reactive-sculpture',
    uniforms,
    defines: { FBM_OCTAVES: 2 },
    vertexShader: /* glsl */ `
      uniform float uPhase;
      uniform float uGrowth;
      uniform float uComplexity;
      uniform float uTwist;
      uniform float uPulse;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vRidge;
      ${FBM_GLSL}

      vec3 twist(vec3 p, float amount) {
        float a = p.y * amount;
        float c = cos(a), s = sin(a);
        return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
      }

      // Displacement along the unit direction n (radius 1 in object space before scaling).
      float field(vec3 n) {
        vec3 q = twist(n, uTwist) * uComplexity + vec3(0.0, uPhase, uPhase * 0.6);
        float f = fbm(q);
        return f + 0.35 * abs(fbm(q * 1.9 + 4.0)) ;
      }

      vec3 grow(vec3 n, float radius) {
        float d = field(n);
        return n * radius * (1.0 + uGrowth * 0.55 * d + uPulse * 0.06);
      }

      void main() {
        float radius = length(position);
        vec3 n = normalize(position);
        vec3 helper = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 t = normalize(cross(helper, n));
        vec3 b = cross(n, t);
        const float e = 0.012;
        vec3 p0 = grow(n, radius);
        vec3 p1 = grow(normalize(n + t * e), radius);
        vec3 p2 = grow(normalize(n + b * e), radius);
        vec3 normalO = normalize(cross(p1 - p0, p2 - p0));
        if (dot(normalO, n) < 0.0) normalO = -normalO;

        vRidge = clamp((length(p0) / radius - 1.0) / max(uGrowth * 0.55, 1e-3) * 0.5 + 0.5, 0.0, 1.0);
        vec4 world = modelMatrix * vec4(p0, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normalO);
        vViewDir = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHue;
      uniform float uGlow;
      uniform float uPulse;
      uniform float uAlpha;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uDeep;
      uniform vec3 uLightDir;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vRidge;
      ${PALETTE_GLSL}

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(vViewDir);
        float ndl = max(dot(N, uLightDir), 0.0);
        float hemi = 0.5 + 0.5 * N.y;
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 H = normalize(uLightDir + V);
        float spec = pow(max(dot(N, H), 0.0), 48.0);

        vec3 iridescent = palette(fresnel * 0.8 + vRidge * 0.4 + uHue,
          vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
        vec3 base = mix(uDeep, uPrimary, smoothstep(0.15, 0.85, vRidge));
        base = mix(base, uSecondary, smoothstep(0.7, 1.0, vRidge) * 0.8);
        base = hueShift(base, uHue * 6.2831853);

        vec3 color = base * (0.18 + 0.55 * hemi + 0.75 * ndl);
        color += iridescent * fresnel * 0.9;
        color += spec * 0.6;
        color += hueShift(uSecondary, uHue * 6.2831853) * pow(vRidge, 3.0) * (uGlow * 1.2 + uPulse * 0.8);
        float alpha = clamp(uAlpha + fresnel * (1.0 - uAlpha) * 0.7, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
