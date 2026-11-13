// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Adapted from Meta Chrome by phreax/jiagual (2026).
uniform float uTime;
uniform float uGlowAmount;
uniform vec3 uGlowColor;
uniform float uExposure;
uniform float uReflectionWarmth;
uniform float uIridescence;
uniform vec3 uPinchPoint;
uniform float uPinchActive;
uniform vec3 uRightPinchPoint;
uniform float uRightPinchActive;
uniform float uSphereSize;
uniform float uShowSpheres;
uniform float uSminFactor;
uniform int uSteps;
uniform sampler2D uPalette;
uniform samplerCube uEnvironment;
__BOUNDED_SPHERE_RAY_GLSL__
const float CHROME_SCALE = __CHROME_SCALE__;
const float PI = 3.14159265;
float tt;
float gGlow;

mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float smin(float a, float b, float k) {
  float h = clamp((a - b) / k * .5 + .5, 0., 1.);
  return mix(a, b, h) - h * (1. - h) * k;
}
float box(vec3 p, vec3 r) {
  vec3 d = abs(p) - r;
  return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.);
}
float map(vec3 p) {
  vec3 original = p;
  p.y = abs(p.y) - .4;
  vec3 pair = p;
  p -= vec3(-.5 * sin(.4 * tt), 0., 0.);
  p.xy *= rot(tt);
  p.yz *= rot(.5 * tt);
  float d = box(p, vec3(.3)) - .01;
  p = pair - vec3(.6 * sin(.4 * tt), 0., 0.);
  p.xy *= rot(-tt);
  p.yz *= rot(.5 * tt);
  d = min(d, box(p, vec3(.3)) - .01);

  p = original - vec3(-.5 * sin(.4 * tt), -.2 * cos(.4 * tt), 0.);
  float e = length(p) - .4;
  p = original - vec3(-.4 * cos(.4 * tt), -.4 * sin(.4 * tt), -.2 * cos(.4 * tt));
  float f = length(p) - .35;
  e = smin(max(e, -f), f + .1, .2);
  p = original - vec3(-.5 * cos(.2 * tt), -.4 * sin(.4 * tt), -.2 * cos(.4 * tt));
  e = smin(e, length(p) - .25, .25);
  float cube = max(d, -e);
  d = min(e + .1, cube);
  gGlow += .002 / (.01 + pow((e + .1) * 4.4, 2.));
  float base = d;
  if (uPinchActive > .5) d = smin(d, length(original - uPinchPoint) - uSphereSize, uSminFactor);
  if (uRightPinchActive > .5) d = smin(d, length(original - uRightPinchPoint) - uSphereSize, uSminFactor);
  // Hidden spheres can deform the surface but cannot appear as isolated blobs.
  if (uShowSpheres < .5) d = max(d, base - uSphereSize * .6);
  return d * .8;
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(.002, 0.);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}
float aoAt(vec3 p, vec3 n) {
  float occ = 0., weight = 1.;
  for (int i = 0; i < 3; i++) {
    float h = .04 + float(i) * .1;
    occ += max(h - map(p + n * h), 0.) * weight;
    weight *= .65;
  }
  return clamp(1. - occ * 1.5, .2, 1.);
}
vec3 palette(float t) { return texture(uPalette, vec2(fract(t), .5)).rgb; }

void main() {
  tt = uTime;
  gGlow = 0.;
  vec3 ro, rd;
  float nearT, farT;
  if (!boundedSphereRay(ro, rd, nearT, farT)) discard;
  vec3 origin = ro * CHROME_SCALE;
  float t = nearT * CHROME_SCALE;
  float endT = farT * CHROME_SCALE;
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    if (i >= uSteps || t >= endT) break;
    float d = map(origin + rd * t);
    if (d < .002) { hit = true; break; }
    t += max(d, .002);
  }
  float glow = min(gGlow * (200. / float(uSteps)), 8.);
  float glowStrength = .15 * glow * uGlowAmount;
  vec3 color = uGlowColor;
  float alpha = clamp(glowStrength, 0., .85);
  if (hit) {
    vec3 p = origin + rd * t;
    vec3 n = normalAt(p);
    vec3 v = -rd;
    vec3 l1 = boundedLightDirection(vec3(.24, .4, .88));
    vec3 l2 = boundedLightDirection(vec3(.9, -.2, .2));
    float diffuse = max(dot(n, l1), 0.) + .6 * max(dot(n, l2), 0.);
    float spec = pow(max(dot(reflect(-l2, n), v), 0.), 50.);
    vec3 reflected = boundedWorldDirection(reflect(rd, n));
    vec3 chrome = texture(uEnvironment, reflected).rgb;
    float warmth = clamp(uReflectionWarmth, 0., 1.);
    float luminance = dot(chrome, vec3(.2126, .7152, .0722));
    chrome = mix(vec3(luminance), chrome, warmth);
    chrome *= vec3(1. + .12 * warmth, 1., 1. - .08 * warmth);
    float iriMask = .3 + .7 * (1. - smoothstep(.2, .8, abs(dot(n, v))));
    vec3 iri = palette(atan(n.y, n.x) / (2. * PI)) * iriMask * 1.4 * uIridescence;
    color = chrome * (1.1 + .25 * diffuse) + .22 * spec + iri;
    color *= aoAt(p, n);
    alpha = 1.;
  }
  alpha *= boundedOcclusion(origin + rd * (hit ? t : nearT * CHROME_SCALE), CHROME_SCALE);
  if (alpha < .01) discard;
  gl_FragDepth = boundedFragDepth(origin + rd * (hit ? t : endT), CHROME_SCALE);
  gl_FragColor = vec4(color * uExposure, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
