import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FloatType,
  LinearFilter,
  Mesh,
  ShaderMaterial,
  Color,
  Vector3,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
} from '@iwsdk/core';
import { CURVE_ROWS, CURVE_SAMPLES, type Curve } from './curve.js';
import type { Crawl } from './crawl.js';
import { buildGradientData, GRADIENT_SIZE } from './gradient.js';
import { PATTERN_INDEX, patternCells, SNAKE_FRAGMENT_COMMON, SNAKE_SPECTRAL_GLSL, SNAKE_VERTEX_COMMON } from './snake-glsl.js';
import { effectiveTwist, gradientRepeats, type SnakeLook } from './snake-look.js';

export type { SnakeLook } from './snake-look.js';
export { DEFAULT_LOOK } from './snake-look.js';

/** Medium quality from shader-lab: 192 rings along × 24 around (~9k triangles). */
const ALONG = 192;
const AROUND = 24;

/** One grid: x = body parameter (tail → head), y = angle around. The seam column is duplicated. */
export const createSnakeGeometry = (along = ALONG, around = AROUND): BufferGeometry => {
  const columns = around + 1;
  const rows = along + 1;
  const positions = new Float32Array(rows * columns * 3);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const o = (row * columns + column) * 3;
      positions[o] = row / along;
      positions[o + 1] = column / around;
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < along; row += 1) {
    for (let column = 0; column < around; column += 1) {
      const a = row * columns + column;
      const b = a + columns;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
};

export const createSnakeRenderer = () => {
  const curveTexture = new DataTexture(new Float32Array(CURVE_ROWS * CURVE_SAMPLES * 4), CURVE_SAMPLES, CURVE_ROWS, RGBAFormat, FloatType);
  curveTexture.magFilter = NearestFilter;
  curveTexture.minFilter = NearestFilter;
  curveTexture.generateMipmaps = false;
  const gradientTexture = new DataTexture(new Uint8Array(GRADIENT_SIZE * 4), GRADIENT_SIZE, 1);
  gradientTexture.colorSpace = SRGBColorSpace;
  gradientTexture.magFilter = LinearFilter;
  gradientTexture.minFilter = LinearFilter;

  const uniforms = {
    uSnakeCurve: { value: curveTexture },
    uSnakeCurveLength: { value: 1 },
    uSnakeClosed: { value: 0 },
    uSnakeHead: { value: 0 },
    uSnakeTail: { value: 0 },
    uSnakeThickness: { value: 0.02 },
    uSnakeHeadTaper: { value: 0.1 },
    uSnakeTailTaper: { value: 0.5 },
    uSnakeHeadShape: { value: 0 },
    uSnakeProfile: { value: 0 },
    uSnakeTwist: { value: 0 },
    uSnakeTwistPhase: { value: 0 },
    uSnakePattern: { value: 0 },
    uSnakeBackgroundMode: { value: 0 },
    uSnakeBackgroundOffset: { value: 0.5 },
    uSnakeBackgroundBrightness: { value: 0.35 },
    uSnakeRepeats: { value: 4 },
    uSnakeCellLength: { value: 0.1 },
    uSnakeWidth: { value: 0.5 },
    uSnakeBodyLength: { value: 1 },
    uSnakeGradient: { value: gradientTexture },
    uSnakeGradientRepeats: { value: 1 },
    uSnakeHilbertRound: { value: 1 },
    // Lighting (world space). Key and fill colours follow gold_fractal's warm / cyan pair.
    uKeyDirection: { value: new Vector3(-0.4, 0.8, 0.45).normalize() },
    uKeyColor: { value: new Color(0.953, 0.922, 0.824) },
    uFillDirection: { value: new Vector3(0.7, 0.25, -0.3).normalize() },
    uFillColor: { value: new Color(0.757, 0.941, 0.941).multiplyScalar(0.55) },
    uSkyColor: { value: new Color(0.1, 0.16, 0.17) },
    uGroundColor: { value: new Color(0.03, 0.025, 0.05) },
    uRoughness: { value: 0.35 },
    uMetallic: { value: 0.2 },
    uIridescence: { value: 0.5 },
    uGratingSpacing: { value: 1650 },
  };

  /**
   * Custom lighting instead of a PBR material: diffuse + Blinn specular (roughness / metallic have a
   * clear effect), a diffraction-grating term (Iridescence) and no environment / fresnel sheen, so
   * grazing angles don't turn frosted.
   */
  const material = new ShaderMaterial({
    name: 'cyberdelic-snake',
    uniforms,
    side: DoubleSide, // transparent patterns show the inside of the tube
    vertexShader: /* glsl */ `
      ${SNAKE_VERTEX_COMMON}
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldForward;
      void main() {
        vec3 p, n;
        snakeDeform(position, p, n);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * n);
        vWorldForward = normalize(mat3(modelMatrix) * gSnakeForward);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SNAKE_FRAGMENT_COMMON}
      ${SNAKE_SPECTRAL_GLSL}
      uniform vec3 uKeyDirection;
      uniform vec3 uKeyColor;
      uniform vec3 uFillDirection;
      uniform vec3 uFillColor;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      uniform float uRoughness;
      uniform float uMetallic;
      uniform float uIridescence;
      uniform float uGratingSpacing;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldForward;

      vec3 snakeLight(vec3 albedo, vec3 n, vec3 v, vec3 t, vec3 l, vec3 lightColor, float shininess) {
        float diffuse = max(dot(n, l), 0.0);
        vec3 h = normalize(l + v);
        // Normalised Blinn: rough = broad and dim, smooth = small and bright.
        float specular = pow(max(dot(n, h), 0.0), shininess) * (shininess + 8.0) / 25.0 * step(0.0, dot(n, l));
        vec3 specularColor = mix(vec3(0.04), albedo, uMetallic);
        vec3 grating = snakeDiffraction(-v, t, l, uGratingSpacing) * sqrt(diffuse);
        return lightColor * (albedo * (1.0 - uMetallic) * diffuse + specularColor * specular + grating * uIridescence * 1.5);
      }

      void main() {
        vec4 body = snakeBodyColor(vSnakeBody);
        if (body.a < 0.5) discard;
        vec3 albedo = body.rgb;
        vec3 n = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 t = normalize(vWorldForward);
        float shininess = exp2(mix(10.0, 1.5, uRoughness));
        vec3 ambient = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5) * albedo * (1.0 - 0.6 * uMetallic) * 2.0;
        vec3 color = ambient
          + snakeLight(albedo, n, v, t, uKeyDirection, uKeyColor, shininess)
          + snakeLight(albedo, n, v, t, uFillDirection, uFillColor, shininess);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.toneMapped = true;

  const mesh = new Mesh(createSnakeGeometry(), material);
  mesh.name = 'snake';
  mesh.frustumCulled = false; // the shader moves every vertex
  mesh.visible = false;

  let curveLength = 1;
  let gradientKey = '';

  return {
    mesh,
    uniforms,
    setCurve(curve: Curve | null) {
      mesh.visible = curve !== null;
      if (!curve) return;
      (curveTexture.image.data as Float32Array).set(curve.data);
      curveTexture.needsUpdate = true;
      curveLength = curve.length;
      uniforms.uSnakeCurveLength.value = curve.length;
      uniforms.uSnakeClosed.value = curve.closed ? 1 : 0;
    },
    setGradient(stops: readonly string[]) {
      const key = stops.join();
      if (key === gradientKey) return;
      gradientKey = key;
      (gradientTexture.image.data as Uint8Array).set(buildGradientData(stops));
      gradientTexture.needsUpdate = true;
    },
    /** Per frame: settings + where the body is. Never touches geometry. */
    apply(look: SnakeLook, crawl: Crawl) {
      const closed = uniforms.uSnakeClosed.value > 0.5;
      uniforms.uSnakeHead.value = crawl.head;
      uniforms.uSnakeTail.value = crawl.tail;
      uniforms.uSnakeThickness.value = look.thickness;
      uniforms.uSnakeHeadTaper.value = look.headTaper;
      uniforms.uSnakeTailTaper.value = look.tailTaper;
      uniforms.uSnakeHeadShape.value = look.headShape;
      uniforms.uSnakeProfile.value = look.profile;
      // Whole turns on loops, so the frame meets itself and lap wraps never jump.
      uniforms.uSnakeTwist.value = look.profile > 0 ? Math.max(0, effectiveTwist(look.twist, closed)) : 0;
      uniforms.uSnakeTwistPhase.value = 0;
      uniforms.uSnakePattern.value = PATTERN_INDEX[look.pattern];
      const cells = patternCells(look.pattern, look.scale, look.thickness);
      uniforms.uSnakeRepeats.value = cells.repeats;
      uniforms.uSnakeCellLength.value = cells.cellLength;
      uniforms.uSnakeWidth.value = look.width;
      uniforms.uSnakeBodyLength.value = Math.abs(crawl.head - crawl.tail) * curveLength;
      uniforms.uSnakeGradientRepeats.value = gradientRepeats(look.spread);
      uniforms.uSnakeBackgroundMode.value = look.transparent ? 0 : 1;
      uniforms.uSnakeBackgroundOffset.value = look.backgroundOffset;
      uniforms.uSnakeBackgroundBrightness.value = look.backgroundBrightness;
      uniforms.uRoughness.value = look.roughness;
      uniforms.uMetallic.value = look.metallic;
      uniforms.uIridescence.value = look.iridescence;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      curveTexture.dispose();
      gradientTexture.dispose();
    },
  };
};

export type SnakeRenderer = ReturnType<typeof createSnakeRenderer>;
