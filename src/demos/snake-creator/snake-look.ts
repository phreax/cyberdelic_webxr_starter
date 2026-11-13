// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import type { SnakePattern } from './snake-glsl.js';

/** Pure helpers for snake look parameters (TS mirrors of shader behaviour). */

/** A twisted tube only meets itself around a loop after whole turns; open paths keep any twist. */
export const effectiveTwist = (twist: number, closed: boolean): number => (closed ? Math.round(twist) : twist);

/** Frame twist angle at arc position `s` (radians), as computed in snakeFrame(). */
export const twistAngle = (twist: number, s: number): number => 2 * Math.PI * twist * s;

/** Spread 0..1 → 0..20 gradient repeats; zero samples one colour everywhere. */
export const gradientRepeats = (spread: number): number => 20 * Math.max(0, Math.min(1, spread));
export const gradientPosition = (bodyFraction: number, spread: number, offset: number): number => {
  const position = bodyFraction * gradientRepeats(spread) + offset;
  if (position >= 0 && position < 1) return position;
  return ((position % 1) + 1) % 1;
};

/** CPU match for snakeSection() in snake-vertex-common.glsl; writes into a reused result. */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const snakeSectionAt = (
  b: number, pathFraction: number, bodyLength: number, curveLength: number,
  look: Pick<SnakeLook, 'thickness' | 'tailTaper' | 'headTaper' | 'headShape'>,
  closed: boolean, out: { normal: number; binormal: number },
): void => {
  const length = Math.max(bodyLength, 1e-4);
  const cap = Math.min(0.5, look.thickness / length);
  const tail = clamp01(b / Math.max(look.tailTaper, cap));
  const nose = clamp01((1 - b) / Math.max(look.headTaper, cap));
  let radius = look.thickness * (1 - (1 - tail) ** 2) * Math.sqrt(nose * (2 - nose));
  const headSpan = Math.max(cap, Math.min(0.3, 6 * look.thickness / length));
  const k = (1 - b) / headSpan;
  const bulge = k < 1 ? Math.sin(Math.PI * clamp01(k)) ** 0.7 : 0;
  const neck = Math.exp(-(((k - 1.15) / 0.3) ** 2));
  const headShape = look.headTaper === 0 ? 0 : look.headShape;
  radius *= 1 - 0.3 * headShape * neck;
  if (!closed) {
    const reach = 4 * look.thickness / Math.max(curveLength, 1e-4);
    const a = clamp01(pathFraction / reach), z = clamp01((1 - pathFraction) / reach);
    radius *= a * a * (3 - 2 * a) * z * z * (3 - 2 * z);
  }
  out.normal = radius * (1 - 0.35 * headShape * bulge);
  out.binormal = radius * (1 + 0.45 * headShape * bulge);
};

/** Everything the menu controls. Lengths in metres; `length` is a fraction of the path. */
export type SnakeLook = {
  thickness: number;
  length: number;
  headTaper: number;
  tailTaper: number;
  headShape: number;
  /** 'tube', 'spheres', or the id of a plug-in body (see body-plugin.ts). */
  body: string;
  /** Spheres: 0 = one, 0.5 = just touching, 1 = densely overlapping. */
  sphereDensity: number;
  /** Spheres: size relative to the body radius. */
  sphereSize: number;
  profile: 0 | 4;
  twist: number;
  pattern: SnakePattern;
  scale: number;
  width: number;
  hilbertSharpness: number;
  /** Gradient repetition along the body (0..1 → 1x at 0.05, 20x at 1). */
  spread: number;
  /** Position within the selected cyclic palette. */
  gradientOffset: number;
  /** Gaps between pattern lines are cut out (see-through). Off: filled with the background colour. */
  transparent: boolean;
  backgroundOffset: number;
  backgroundBrightness: number;
  /** Diffraction-grating shimmer along the body. */
  iridescence: number;
  /** Glowing core (plug-in bodies with `core.glow`): strength and hue. */
  glow: number;
  glowColor: string;
  mirror: boolean;
  mirrorDistance: number;
  metallic: number;
  /** Strength of the environment reflection, independent of metallic. */
  environmentAmount: number;
  roughness: number;
  /** Path fractions per second. */
  speed: number;
  reverse: boolean;
  /** Settings added by plug-in bodies (`SnakeBodyDefinition.params`). */
  [extra: string]: unknown;
};

export const DEFAULT_LOOK: Readonly<SnakeLook> = {
  thickness: 0.02, length: 0.35, headTaper: 0.1, tailTaper: 0.5, headShape: 0.6, body: 'tube', sphereDensity: 0.5, sphereSize: 1, profile: 0, twist: 0,
  pattern: 'rings', scale: 1, width: 0.5, hilbertSharpness: 1, spread: 0.05, gradientOffset: 0, transparent: false, backgroundOffset: 0.5,
  backgroundBrightness: 0, iridescence: 0.1, glow: 0, glowColor: '#64f4ff', mirror: false, mirrorDistance: 0.2, metallic: 0.2, environmentAmount: 0.2, roughness: 0.35, speed: 0.15, reverse: false,
};


/** Sphere budget per snake (one static strip, drawn up to the active count). */
export const MAX_SPHERES = 256;

/**
 * Spheres strung along the body (shader-lab getSnakeShapeCount): density 0 → one sphere,
 * 0.5 → spheres just touching (2.2 r apart), 1 → densely overlapping (0.55 r apart).
 */
export const sphereCount = (bodyLength: number, radius: number, density: number): number => {
  const r = Math.max(1e-5, radius);
  const maximum = Math.max(1, Math.min(MAX_SPHERES, Math.floor(bodyLength / (0.55 * r))));
  const normal = Math.max(1, Math.min(maximum, Math.floor(bodyLength / (2.2 * r) + 1e-9)));
  const d = Math.max(0, Math.min(1, density));
  return Math.round(d <= 0.5 ? 1 + (normal - 1) * d * 2 : normal + (maximum - normal) * (d - 0.5) * 2);
};
