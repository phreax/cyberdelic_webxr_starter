/** Colour helpers for the ColorPicker. HSV components are 0..1. */
export type HSV = { h: number; s: number; v: number };

export const hexToHsv = (hex: string): HSV => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
};

export const hsvToHex = ({ h, s, v }: HSV): string => {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const byte = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return `#${byte(f(5))}${byte(f(3))}${byte(f(1))}`;
};
