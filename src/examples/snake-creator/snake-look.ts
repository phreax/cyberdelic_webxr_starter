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
  profile: 0 | 4;
  twist: number;
  pattern: SnakePattern;
  scale: number;
  width: number;
  /** Gradient repetition along the body (0..1 → 1x at 0.05, 20x at 1). */
  spread: number;
  /** Off = gaps between pattern lines are cut out; on = filled with the gradient at an offset. */
  background: boolean;
  backgroundOffset: number;
  backgroundBrightness: number;
  iridescence: number;
  /** Clearcoat amount. */
  gloss: number;
  metallic: number;
  roughness: number;
  /** Path fractions per second. */
  speed: number;
  reverse: boolean;
};

export const DEFAULT_LOOK: Readonly<SnakeLook> = {
  thickness: 0.02, length: 0.35, headTaper: 0.1, tailTaper: 0.5, headShape: 0.6, profile: 0, twist: 0,
  pattern: 'rings', scale: 1, width: 0.5, spread: 0.05, background: false, backgroundOffset: 0.5,
  backgroundBrightness: 0.35, iridescence: 0.4, gloss: 0.6, metallic: 0.1, roughness: 0.35, speed: 0.15, reverse: false,
};

