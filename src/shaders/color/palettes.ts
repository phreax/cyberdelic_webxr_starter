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
  // shader-lab (Karleido) config/palettes.json — used by the raymarched demos (e.g. Cubes).
  'Vibrant Coral': ['#540d6e', '#ee4266', '#ffd23f', '#3bceac', '#0ead69'],
  Neon: ['#00ccff', '#00ffcc', '#ffff00', '#ff00cc', '#cc00ff'],
  'Ocean Sunset': ['#1be7ff', '#6eeb83', '#e4ff1a', '#ffb800', '#ff5714'],
  'Cosine Rainbow': 'cosine-rainbow',
  Chameleon: ['#2bc2b7', '#5b8402', '#9ad942', '#d13c32', '#851305'],
  'Spectral Rainbow': 'spectral',
  'Candy Land': ['#ff1a88', '#c666f9', '#1be7ff', '#6eeb83', '#e4ff1a', '#ffb800', '#ff5714'],
  Pastel: ['#9b5de5', '#f15bb5', '#fee440', '#00bbf9', '#00f5d4'],
  Vulcano: ['#edae49', '#d1495b', '#00798c', '#30638e', '#003d5b'],
  'SciFi Machine': ['#002439', '#005066', '#4e7988', '#78cce2', '#e4eff0'],
  'B&W': 'black-white',
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

/** Zucconi spectral palette (shader-lab "Spectral Rainbow"). */
export const spectralZucconi = (t: number): [number, number, number] => {
  const x = t - Math.floor(t);
  const c1 = [3.54585104, 2.93225262, 2.41593945], x1 = [0.69549072, 0.49228336, 0.2769988], y1 = [0.02312639, 0.15225084, 0.52607955];
  const c2 = [3.9030714, 3.21182957, 3.96587128], x2 = [0.11748627, 0.86755042, 0.6607786], y2 = [0.8489713, 0.88445281, 0.73949448];
  const bump = (c: number, x0: number, y0: number) => Math.min(1, Math.max(0, 1 - (c * (x - x0)) ** 2 - y0));
  return [0, 1, 2].map((i) => bump(c1[i]!, x1[i]!, y1[i]!) + bump(c2[i]!, x2[i]!, y2[i]!)) as [number, number, number];
};

const GENERATORS: Record<string, (t: number) => [number, number, number]> = {
  'cosine-rainbow': cosineRainbow,
  spectral: spectralZucconi,
  'black-white': (t) => {
    const v = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI);
    return [v, v, v];
  },
};

export const bakePalette = (name: PaletteName): Uint8Array => {
  const entry = PALETTES[name];
  if (typeof entry !== 'string') return buildGradientData(entry);
  const generate = GENERATORS[entry]!;
  const data = new Uint8Array(PALETTE_SIZE * 4);
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < PALETTE_SIZE; i += 1) {
    const [r, g, b] = generate(i / PALETTE_SIZE);
    data.set([byte(r), byte(g), byte(b), 255], i * 4);
  }
  return data;
};

/** A representative colour (for markers / zone rings): the middle of the baked palette. */
export const paletteAccent = (name: PaletteName): string => {
  const data = bakePalette(name);
  const i = (PALETTE_SIZE / 2) * 4;
  return `#${[data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
