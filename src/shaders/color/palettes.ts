/**
 * Shared colour palettes, baked into 256×1 RGBA8 sRGB textures for shaders.
 * Ethereal Garden, Cyberdelic and Cosine Rainbow come from shader-lab (Karleido).
 */
export const PALETTE_SIZE = 256;

export const PALETTES = {
  'Ethereal Garden': ['#2c1b69', '#6a00ff', '#a64aff', '#00e5ff', '#54ad25', '#d6e316'],
  Cyberdelic: ['#2c1b69', '#6a00ff', '#a64aff', '#00e5ff'],
  Ocean: ['#03256C', '#2541B2', '#1768AC', '#06BEE1', '#FFFFFF'],
  Ember: ['#2B0A3D', '#C81D25', '#FF9500', '#FFE066'],
  /** Generative: shader-lab "Cosine Rainbow". */
  Rainbow: 'cosine-rainbow',
} as const;
export type PaletteName = keyof typeof PALETTES;

/** shader-lab paletteCosineRainbow: 0.5 + 0.5·cos(2π·fract(t) + (0, 2, 4)). */
export const cosineRainbow = (t: number): [number, number, number] => {
  const a = 2 * Math.PI * (t - Math.floor(t));
  return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.cos(a + 2), 0.5 + 0.5 * Math.cos(a + 4)];
};

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/**
 * Cyclic bake of colour stops: the last colour blends back into the first, so a gradient
 * repeated along a body or over time has no seam where it wraps.
 */
export const buildGradientData = (stops: readonly string[], sharpness = 0): Uint8Array => {
  const base = (stops.length >= 1 ? stops : ['#ffffff']).map(rgb);
  const colors = [...base, base[0]!];
  const data = new Uint8Array(PALETTE_SIZE * 4);
  const transition = 1 - Math.max(0, Math.min(1, sharpness));
  for (let i = 0; i < PALETTE_SIZE; i += 1) {
    const position = (i / (PALETTE_SIZE - 1)) * (colors.length - 1);
    const from = Math.min(colors.length - 2, Math.floor(position));
    const fraction = position - from;
    const t = transition === 0 ? (fraction < 0.5 ? 0 : 1) : Math.max(0, Math.min(1, (fraction - 0.5) / transition + 0.5));
    for (let c = 0; c < 3; c += 1) data[i * 4 + c] = Math.round(colors[from]![c]! + (colors[from + 1]![c]! - colors[from]![c]!) * t);
    data[i * 4 + 3] = 255;
  }
  return data;
};

export const bakePalette = (name: PaletteName): Uint8Array => {
  const entry = PALETTES[name];
  if (typeof entry !== 'string') return buildGradientData(entry);
  const data = new Uint8Array(PALETTE_SIZE * 4);
  for (let i = 0; i < PALETTE_SIZE; i += 1) {
    const [r, g, b] = cosineRainbow(i / PALETTE_SIZE);
    data.set([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255], i * 4);
  }
  return data;
};

/** A representative colour (for markers / zone rings): the middle of the baked palette. */
export const paletteAccent = (name: PaletteName): string => {
  const data = bakePalette(name);
  const i = (PALETTE_SIZE / 2) * 4;
  return `#${[data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
