import { buildGradientData, PALETTES, PALETTE_SIZE } from '../../shaders/color/palettes.js';

/** Snake gradients use the shared palettes (src/shaders/color/palettes.ts). */
export { buildGradientData };
export const GRADIENT_SIZE = PALETTE_SIZE;

export const SNAKE_PALETTES = {
  'Ethereal Garden': PALETTES['Ethereal Garden'],
  Cyberdelic: PALETTES.Cyberdelic,
  Ocean: PALETTES.Ocean,
  Ember: PALETTES.Ember,
} as const;
export type SnakePaletteName = keyof typeof SNAKE_PALETTES;
