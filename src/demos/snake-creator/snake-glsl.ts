// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { CURVE_SAMPLES } from './curve.js';
import sourceSnakeVertexCommon from './snake-vertex-common.glsl?raw';
import sourceSnakeFragmentCommon from './snake-fragment-common.glsl?raw';
import sourceSnakeSpectralGlsl from './snake-spectral.glsl?raw';

/**
 * Snake GLSL, ported from shader-lab (Karleido) snakeGlsl.ts + pattern.ts (MIT, with permission).
 * Kept: tube body bent along the curve texture, tapers, head shape, round/square/hex profile,
 * twist, rings / hilbert / solid patterns with gradient. Removed: stage occlusion, holes, slices,
 * spheres, streaming. Added: closed loops (curve lookups wrap; no end pinch).
 */
export const HILBERT_SIZE = 8;
export const PATTERN_INDEX = { rings: 0, hilbert: 1, solid: 3 } as const;
export type SnakePattern = keyof typeof PATTERN_INDEX;

export const SNAKE_VERTEX_COMMON = sourceSnakeVertexCommon.replace('__CURVE_SAMPLES__', String(CURVE_SAMPLES));

export const SNAKE_FRAGMENT_COMMON = sourceSnakeFragmentCommon.replace('__HILBERT_SIZE__', String(HILBERT_SIZE)).replace('__PATTERN_INDEX_HILBERT__', String(PATTERN_INDEX.hilbert)).replace('__PATTERN_INDEX_SOLID__', String(PATTERN_INDEX.solid));
/** Cells around the body; whole repeats keep the wrap seamless; cells stay square on the body. */
const BASE_REPEATS: Record<SnakePattern, number> = { rings: 4, hilbert: 1, solid: 1 };
export const patternCells = (pattern: SnakePattern, scale: number, radius: number) => {
  const repeats = Math.max(1, Math.round(BASE_REPEATS[pattern] / Math.max(0.1, scale)));
  return { repeats, cellLength: (2 * Math.PI * radius) / repeats };
};

/** Zucconi spectral palette + physically based diffraction grating, from gold_fractal (phreax). */
export const SNAKE_SPECTRAL_GLSL = sourceSnakeSpectralGlsl;
