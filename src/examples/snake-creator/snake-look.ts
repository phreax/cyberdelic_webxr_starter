import type { SnakePattern } from './snake-glsl.js';

/** Pure helpers for snake look parameters (TS mirrors of shader behaviour). */

/** A twisted tube only meets itself around a loop after whole turns; open paths keep any twist. */
export const effectiveTwist = (twist: number, closed: boolean): number => (closed ? Math.round(twist) : twist);

/** Frame twist angle at arc position `s` (radians), as computed in snakeFrame(). */
export const twistAngle = (twist: number, s: number): number => 2 * Math.PI * twist * s;

/** Spread 0..1 → gradient repeats along the body (shader-lab: 20 × spread), never zero. */
export const gradientRepeats = (spread: number): number => Math.max(0.05, 20 * spread);

/** Everything the menu controls. Lengths in metres; `length` is a fraction of the path. */
export type SnakeLook = {
  thickness: number;
  length: number;
  headTaper: number;
  tailTaper: number;
  headShape: number;
  /** Tube or spheres strung along the body. */
  body: 'tube' | 'spheres';
  /** Spheres: 0 = one, 0.5 = just touching, 1 = densely overlapping. */
  sphereDensity: number;
  /** Spheres: size relative to the body radius. */
  sphereSize: number;
  profile: 0 | 4;
  twist: number;
  pattern: SnakePattern;
  scale: number;
  width: number;
  /** Gradient repetition along the body (0..1 → 1x at 0.05, 20x at 1). */
  spread: number;
  /** Gaps between pattern lines are cut out (see-through). Off: filled with the background colour. */
  transparent: boolean;
  backgroundOffset: number;
  backgroundBrightness: number;
  /** Diffraction-grating shimmer along the body. */
  iridescence: number;
  metallic: number;
  roughness: number;
  /** Path fractions per second. */
  speed: number;
  reverse: boolean;
};

export const DEFAULT_LOOK: Readonly<SnakeLook> = {
  thickness: 0.02, length: 0.35, headTaper: 0.1, tailTaper: 0.5, headShape: 0.6, body: 'tube', sphereDensity: 0.5, sphereSize: 1, profile: 0, twist: 0,
  pattern: 'rings', scale: 1, width: 0.5, spread: 0.05, transparent: false, backgroundOffset: 0.5,
  backgroundBrightness: 0, iridescence: 0.5, metallic: 0.2, roughness: 0.35, speed: 0.15, reverse: false,
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
