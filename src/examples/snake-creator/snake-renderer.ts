import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FloatType,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  type WebGLProgramParametersWithUniforms,
} from '@iwsdk/core';
import { CURVE_ROWS, CURVE_SAMPLES, type Curve } from './curve.js';
import type { Crawl } from './crawl.js';
import { buildGradientData, GRADIENT_SIZE } from './gradient.js';
import { PATTERN_INDEX, patternCells, SNAKE_FRAGMENT_COMMON, SNAKE_VERTEX_COMMON, type SnakePattern } from './snake-glsl.js';
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
  // Placeholder normals: without a normal attribute three.js forces FLAT_SHADED and ignores the
  // smooth normals computed in snakeDeform(). The shader overwrites them.
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(rows * columns * 3), 3));
  geometry.setIndex(indices);
  return geometry;
};

const injectAfter = (source: string, include: string, code: string) => {
  if (!source.includes(include)) throw new Error(`Snake shader patch: ${include} not found`);
  return source.replace(include, `${include}\n${code}`);
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
  };

  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.1,
    iridescence: 0.4,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 620],
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    // Cut-out patterns show the inside of the tube.
    side: DoubleSide,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    let vertex = injectAfter(shader.vertexShader, '#include <common>', SNAKE_VERTEX_COMMON);
    vertex = injectAfter(vertex, '#include <beginnormal_vertex>', 'vec3 snakeP, snakeN;\nsnakeDeform(position, snakeP, snakeN);\nobjectNormal = snakeN;');
    shader.vertexShader = injectAfter(vertex, '#include <begin_vertex>', 'transformed = snakeP;');
    const fragment = injectAfter(shader.fragmentShader, '#include <common>', SNAKE_FRAGMENT_COMMON);
    shader.fragmentShader = injectAfter(
      fragment,
      '#include <color_fragment>',
      'vec4 snakeColor = snakeBodyColor(vSnakeBody);\nif (snakeColor.a < 0.5) discard;\ndiffuseColor.rgb *= snakeColor.rgb;',
    );
  };
  material.customProgramCacheKey = () => 'cyberdelic-snake-v2';

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
      uniforms.uSnakeBackgroundMode.value = look.background ? 1 : 0;
      uniforms.uSnakeBackgroundOffset.value = look.backgroundOffset;
      uniforms.uSnakeBackgroundBrightness.value = look.backgroundBrightness;
      material.metalness = look.metallic;
      material.roughness = look.roughness;
      material.iridescence = look.iridescence;
      material.clearcoat = look.gloss;
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
