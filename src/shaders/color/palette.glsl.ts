/** Cosine palette (Inigo Quilez): color(t) = a + b * cos(2π(c·t + d)). */
export const PALETTE_GLSL = /* glsl */ `
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318531 * (c * t + d));
}
vec3 hueShift(vec3 color, float hue) {
  const vec3 k = vec3(0.57735);
  float c = cos(hue), s = sin(hue);
  return color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
}
`;
