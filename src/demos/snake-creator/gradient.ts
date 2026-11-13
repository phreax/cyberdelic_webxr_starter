// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { buildGradientData, PALETTES, PALETTE_SIZE } from '../../shaders/color/palettes.js';

/** Snake gradients use the shared palettes (src/shaders/color/palettes.ts). */
export { buildGradientData };
export const GRADIENT_SIZE = PALETTE_SIZE;

export const SNAKE_PALETTES = {
  'Ethereal Garden': PALETTES['Ethereal Garden'],
  Cyberdelic: PALETTES.Cyberdelic,
  Ocean: PALETTES.Ocean,
  Ember: PALETTES.Ember,
  White: ['#ffffff'],
  'SciFi Machine': PALETTES['SciFi Machine'],
} as const;
export type SnakePaletteName = keyof typeof SNAKE_PALETTES;
