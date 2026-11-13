// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  AdditiveBlending,
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
  type CubeTexture,
} from '@iwsdk/core';
import { CURVE_ROWS, CURVE_SAMPLES, type Curve } from './curve.js';
import { createDepthOcclusionUniforms, DEPTH_OCCLUSION_GLSL } from '../../shaders/depth-occlusion.js';
import type { Crawl } from './crawl.js';
import { buildGradientData, GRADIENT_SIZE } from './gradient.js';
import { PATTERN_INDEX, patternCells, SNAKE_FRAGMENT_COMMON, SNAKE_SPECTRAL_GLSL, SNAKE_VERTEX_COMMON } from './snake-glsl.js';
import { effectiveTwist, gradientRepeats, MAX_SPHERES, sphereCount, type SnakeLook } from './snake-look.js';
import vertexSource from './snake.vert.glsl?raw';
import fragmentSource from './snake.frag.glsl?raw';
import haloSource from './snake-halo.frag.glsl?raw';
const VERTEX_SHADER = vertexSource.replace('__SNAKE_VERTEX_COMMON__', SNAKE_VERTEX_COMMON);
const FRAGMENT_SHADER = fragmentSource.replace('__SNAKE_FRAGMENT_COMMON__', SNAKE_FRAGMENT_COMMON).replace('__SNAKE_SPECTRAL_GLSL__', SNAKE_SPECTRAL_GLSL).replace('__DEPTH_OCCLUSION_GLSL__', DEPTH_OCCLUSION_GLSL);
const HALO_SHADER = haloSource.replace('__DEPTH_OCCLUSION_GLSL__', DEPTH_OCCLUSION_GLSL);

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

/** Smooth sphere strip without changing the maximum sphere count. */
const SPHERE_AROUND = 16;
const SPHERE_ROWS = 10;
export const SPHERE_INDICES = SPHERE_ROWS * SPHERE_AROUND * 6;

/** MAX_SPHERES unit UV spheres; `snakeIndex` places each one, `snakeFace` wraps the texture. */
export const createSnakeSphereGeometry = (count = MAX_SPHERES): BufferGeometry => {
  const columns = SPHERE_AROUND + 1;
  const perSphere = (SPHERE_ROWS + 1) * columns;
  const positions = new Float32Array(count * perSphere * 3);
  const indexAttr = new Float32Array(count * perSphere);
  const faces = new Float32Array(count * perSphere * 2);
  const indices: number[] = [];
  for (let sphere = 0; sphere < count; sphere += 1) {
    const base = sphere * perSphere;
    for (let row = 0; row <= SPHERE_ROWS; row += 1) {
      const polar = (row / SPHERE_ROWS) * Math.PI;
      for (let column = 0; column < columns; column += 1) {
        const angle = (column / SPHERE_AROUND) * 2 * Math.PI + Math.PI;
        const v = base + row * columns + column;
        positions.set([-Math.cos(polar), Math.sin(polar) * Math.cos(angle), Math.sin(polar) * Math.sin(angle)], v * 3);
        indexAttr[v] = sphere;
        faces.set([column / SPHERE_AROUND, row / SPHERE_ROWS], v * 2);
      }
    }
    for (let row = 0; row < SPHERE_ROWS; row += 1) {
      for (let column = 0; column < SPHERE_AROUND; column += 1) {
        const a = base + row * columns + column;
        const b = a + columns;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('snakeIndex', new BufferAttribute(indexAttr, 1));
  geometry.setAttribute('snakeFace', new BufferAttribute(faces, 2));
  geometry.setIndex(indices);
  return geometry;
};

export const createSnakeRenderer = (environment: CubeTexture | null = null) => {
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
    uSnakeGradientOffset: { value: 0 },
    uSnakeHilbertRound: { value: 1 },
    uSnakeHilbertSharpness: { value: 1 },
    uSnakeSphereCount: { value: 1 },
    uSnakeSphereSize: { value: 1 },
    // Lighting (world space). Key and fill colours follow gold_fractal's warm / cyan pair.
    uKeyDirection: { value: new Vector3(-0.4, 0.8, 0.45).normalize() },
    uKeyColor: { value: new Color(0.953, 0.922, 0.824) },
    uFillDirection: { value: new Vector3(0.7, 0.25, -0.3).normalize() },
    uFillColor: { value: new Color(0.757, 0.941, 0.941).multiplyScalar(0.55) },
    uSkyColor: { value: new Color(0.1, 0.16, 0.17) },
    uGroundColor: { value: new Color(0.03, 0.025, 0.05) },
    uRoughness: { value: 0.35 },
    uMetallic: { value: 0.2 },
    uEnvironmentAmount: { value: 0.2 },
    uIridescence: { value: 0.1 },
    uGratingSpacing: { value: 1650 },
    uEnvironment: { value: environment },
    uEnvironmentWarmth: { value: 0.5 },
    uGlow: { value: 0 },
    uGlowColor: { value: new Color('#64f4ff') },
    uCoreGlowOnly: { value: 0 },
  };

  /**
   * Custom lighting instead of a PBR material: diffuse + Blinn specular (roughness / metallic have a
   * clear effect), a diffraction-grating term (Iridescence) and no environment / fresnel sheen, so
   * grazing angles don't turn frosted.
   */
  const material = new ShaderMaterial({
    name: 'cyberdelic-snake',
    uniforms: { ...uniforms, ...createDepthOcclusionUniforms() },
    defines: { SNAKE_GEOMETRY: 0 },
    side: DoubleSide, // transparent patterns show the inside of the tube
    transparent: true,
    depthWrite: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });
  material.toneMapped = true;

  const tubeGeometry = createSnakeGeometry();
  const sphereGeometry = createSnakeSphereGeometry();
  const mesh = new Mesh(tubeGeometry, material);
  const haloThickness = { value: 0.008 };
  const haloMaterial = new ShaderMaterial({
    name: 'snake-core-halo',
    uniforms: { ...uniforms, ...createDepthOcclusionUniforms(), uSnakeThickness: haloThickness },
    defines: { SNAKE_GEOMETRY: 0 },
    side: DoubleSide,
    vertexShader: VERTEX_SHADER,
    fragmentShader: HALO_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const halo = new Mesh(tubeGeometry, haloMaterial);
  halo.name = 'snake-core-halo';
  halo.frustumCulled = false;
  halo.renderOrder = 2;
  halo.visible = false;
  let body: SnakeLook['body'] = 'tube';
  mesh.name = 'snake';
  // Raymarched Center Objects are transparent-pass materials that write hit depth.
  // Draw the snake after them so the hit depth, rather than the proxy sphere, owns occlusion.
  mesh.renderOrder = 1;
  mesh.frustumCulled = false; // the shader moves every vertex
  mesh.visible = false;

  let curveLength = 1;
  let gradientKey = '';

  return {
    mesh,
    halo,
    uniforms,
    setEnvironmentWarmth(value: number) { uniforms.uEnvironmentWarmth.value = value; },
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
    apply(look: SnakeLook, crawl: Crawl, core?: { thicknessScale: number; glow: boolean }) {
      const closed = uniforms.uSnakeClosed.value > 0.5;
      uniforms.uSnakeHead.value = crawl.head;
      uniforms.uSnakeTail.value = crawl.tail;
      uniforms.uSnakeThickness.value = look.thickness * (core?.thicknessScale ?? 1);
      uniforms.uSnakeHeadTaper.value = look.headTaper;
      uniforms.uSnakeTailTaper.value = look.tailTaper;
      uniforms.uSnakeHeadShape.value = look.headShape;
      uniforms.uSnakeProfile.value = look.profile;
      // Whole turns on loops, so the frame meets itself and lap wraps never jump.
      uniforms.uSnakeTwist.value = Math.max(0, effectiveTwist(look.twist, closed));
      uniforms.uSnakeTwistPhase.value = 0;
      uniforms.uSnakePattern.value = PATTERN_INDEX[look.pattern];
      const cells = patternCells(look.pattern, look.scale, look.thickness);
      uniforms.uSnakeRepeats.value = cells.repeats;
      uniforms.uSnakeCellLength.value = cells.cellLength;
      uniforms.uSnakeWidth.value = look.width;
      uniforms.uSnakeHilbertSharpness.value = look.hilbertSharpness;
      uniforms.uSnakeBodyLength.value = Math.abs(crawl.head - crawl.tail) * curveLength;
      uniforms.uSnakeGradientRepeats.value = gradientRepeats(look.spread);
      uniforms.uSnakeGradientOffset.value = look.gradientOffset;
      uniforms.uSnakeBackgroundMode.value = look.transparent ? 0 : 1;
      uniforms.uSnakeBackgroundOffset.value = look.backgroundOffset;
      uniforms.uSnakeBackgroundBrightness.value = look.backgroundBrightness;
      if (look.body !== body) {
        body = look.body;
        mesh.geometry = body === 'spheres' ? sphereGeometry : tubeGeometry;
        material.defines.SNAKE_GEOMETRY = body === 'spheres' ? 1 : 0;
        material.needsUpdate = true;
      }
      if (body === 'spheres') {
        const count = sphereCount(uniforms.uSnakeBodyLength.value, look.thickness * look.sphereSize, look.sphereDensity);
        uniforms.uSnakeSphereCount.value = count;
        uniforms.uSnakeSphereSize.value = look.sphereSize;
        sphereGeometry.setDrawRange(0, count * SPHERE_INDICES);
      }
      uniforms.uRoughness.value = look.roughness;
      uniforms.uMetallic.value = look.metallic;
      uniforms.uEnvironmentAmount.value = look.environmentAmount;
      uniforms.uIridescence.value = look.iridescence;
      uniforms.uGlow.value = core?.glow ? look.glow : 0;
      uniforms.uCoreGlowOnly.value = core?.glow ? 1 : 0;
      uniforms.uGlowColor.value.set(look.glowColor);
      haloThickness.value = look.thickness * 0.38;
      halo.visible = !!core?.glow && look.glow > 0.001 && mesh.visible;
    },
    dispose() {
      tubeGeometry.dispose();
      sphereGeometry.dispose();
      material.dispose();
      haloMaterial.dispose();
      curveTexture.dispose();
      gradientTexture.dispose();
    },
  };
};

export type SnakeRenderer = ReturnType<typeof createSnakeRenderer>;
