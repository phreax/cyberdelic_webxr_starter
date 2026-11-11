/** Bake a palette (hex stops) into RGBA8 sRGB texels for the snake's gradient texture. */
export const GRADIENT_SIZE = 256;

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/**
 * Cyclic bake: the last colour blends back into the first, so a gradient repeated along the body
 * (Spread) has no seam where it wraps.
 */
export const buildGradientData = (stops: readonly string[], sharpness = 0): Uint8Array => {
  const base = (stops.length >= 1 ? stops : ['#ffffff']).map(rgb);
  const colors = [...base, base[0]!];
  const data = new Uint8Array(GRADIENT_SIZE * 4);
  const transition = 1 - Math.max(0, Math.min(1, sharpness));
  for (let i = 0; i < GRADIENT_SIZE; i += 1) {
    const position = (i / (GRADIENT_SIZE - 1)) * (colors.length - 1);
    const from = Math.min(colors.length - 2, Math.floor(position));
    const fraction = position - from;
    const t = transition === 0 ? (fraction < 0.5 ? 0 : 1) : Math.max(0, Math.min(1, (fraction - 0.5) / transition + 0.5));
    for (let c = 0; c < 3; c += 1) data[i * 4 + c] = Math.round(colors[from]![c]! + (colors[from + 1]![c]! - colors[from]![c]!) * t);
    data[i * 4 + 3] = 255;
  }
  return data;
};

/** Ethereal Garden + Cyberdelic from shader-lab (Karleido) config/palettes.json; Ocean + Ember. */
export const SNAKE_PALETTES = {
  'Ethereal Garden': ['#2c1b69', '#6a00ff', '#a64aff', '#00e5ff', '#54ad25', '#d6e316'],
  Cyberdelic: ['#2c1b69', '#6a00ff', '#a64aff', '#00e5ff'],
  Ocean: ['#03256C', '#2541B2', '#1768AC', '#06BEE1', '#FFFFFF'],
  Ember: ['#2B0A3D', '#C81D25', '#FF9500', '#FFE066'],
} as const;
export type SnakePaletteName = keyof typeof SNAKE_PALETTES;
