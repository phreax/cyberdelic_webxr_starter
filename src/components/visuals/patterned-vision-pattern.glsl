// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Procedural core adapted from Patterned Vision. Shared by hand and room surfaces.
uniform float uTime;
uniform float uScale;
uniform float uWarpAmount;
uniform vec2 uPosition;
uniform float uChromaAmount;

const float PI = 3.14159265;
const vec2 HEX = vec2(1.7320508, 1.);
float wave(float x) { return sin(x) * .5 + .5; }
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

vec2 hexCoords(vec2 p) {
  vec4 hC = floor(vec4(p, p - vec2(1., .5)) / HEX.xyxy) + .5;
  vec4 h = vec4(p - hC.xy * HEX, p - (hC.zw + .5) * HEX);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
}
float sdHex(vec2 p) {
  p = abs(p);
  return max(dot(p, HEX * .5), p.y);
}
vec2 kalei(vec2 p, vec2 b, int count) {
  for (int i = 0; i < 5; i++) {
    if (i >= count) break;
    p *= rot(PI * float(i) / float(count));
    p = abs(p) - b;
  }
  return p;
}
float hex(vec2 p, float frequency) {
  vec2 cell = hexCoords(p);
  vec2 folded = kalei(cell, HEX / 6., 3);
  cell = mix(cell, folded, wave(uTime * .3));
  float d = sdHex(cell);
  return wave(frequency * abs(d) - 1.5 * uTime + length(p) * 2.);
}
float hexPattern(vec2 p) {
  return hex(p, 25.) + .03 * hex(p * 50., 2.);
}
vec3 patternedVisionColor(vec2 uv) {
  float warp = .05 * uWarpAmount;
  uv *= mix(1. - warp, 1. + warp, wave(length(uv) * 10. + .5 * uTime));
  float secondaryWarp = mix(.9, 1.1, wave(length(uv) * 10. + .3 * uTime));
  uv *= mix(1., secondaryWarp, uWarpAmount);
  uv += uPosition * .4;
  uv *= rot(.4 * PI);
  uv = kalei(uv, HEX / 4., 5);
  uv = kalei(uv, HEX / 6., 3);
  uv *= mix(10., 20., uScale);

  float amount = uChromaAmount * (1. + length(uv) * .1);
  vec2 shift = normalize(uv + vec2(.001)) * amount;
  vec3 pattern = vec3(hexPattern(uv + shift), hexPattern(uv), hexPattern(uv - shift));
  return smoothstep(vec3(.2), vec3(.8), pattern);
}
