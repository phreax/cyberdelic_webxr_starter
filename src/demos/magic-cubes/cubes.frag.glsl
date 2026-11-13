// SPDX-License-Identifier: CC-BY-NC-SA-4.0
uniform float uTime;
uniform float uKaleidoscope;
uniform float uMode;
uniform float uColorMode;
uniform float uColorOffset;
uniform float uGlow;
uniform int uSteps;
uniform sampler2D uPalette;
__BOUNDED_SPHERE_RAY_GLSL__

#define PI 3.14159265359
#define SIN(x) (sin(x) * .5 + .5)
#define S(a, b, x) smoothstep(a, b, x)
const float CUBES_SCALE = __CUBES_SCALE_TOFIXED_1__;

float tt, g_mat, g_glow, _has_cubes, _has_rings, _rings_move;
vec3 g_p, g_id;

mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
vec3 getPalette(float t) { return texture(uPalette, vec2(fract(t), 0.5)).rgb; }

float box(vec3 p, vec3 r) {
  vec3 d = abs(p) - r;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}
float smin(float a, float b, float k) {
  float h = clamp((a - b) / k * .5 + .5, 0.0, 1.0);
  return mix(a, b, h) - h * (1. - h) * k;
}
float pModInterval1(inout float p, float size, float start, float stop) {
  float halfsize = size * 0.5;
  float c = floor((p + halfsize) / size);
  p = mod(p + halfsize, size) - halfsize;
  if (c > stop) { p += size * (c - stop); c = stop; }
  if (c < start) { p += size * (c - start); c = start; }
  return c;
}

float cubeGrid3d(vec3 p, float s, float tc) {
  s *= 1.41;
  float s2 = s / 7.;
  float s3 = s2 - .08 * S(1., 2., tt);
  float g = s2 * 2.0;
  const float N = 3.;
  float idW = pModInterval1(p.z, g, -N, N);
  float idH = pModInterval1(p.y, g, -N, N);
  float idZ = pModInterval1(p.x, g, -N, N);
  g_id = vec3(idW, idH, idZ);
  float sm = mix(1., 0.04, SIN(idW * mix(.2, 4., SIN(tc)) + idH * mix(1.1, .1, SIN(.4 * tc)) + idZ * mix(.2, .5, SIN(.8 * tc + PI)) + 2. * tt + 4.));
  float d = box(p, vec3(min(s3, s2 - .05) * sm)) - .05 * sm;
  return d * mix(.4, 1., sm);
}

float cylc(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(h, r);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float ring(inout vec3 p, float r, float off) {
  p.xz *= rot(.5 * tt + off);
  p.yz *= rot(tt + off);
  vec3 pc = p;
  pc.yz *= mat2(0.0, -1.0, 1.0, 0.0);
  float c = cylc(pc, r, .05);
  float ci = cylc(pc, r - 0.22, .2);
  return max(c, -ci);
}
float rings(vec3 p) {
  vec3 bp = p;
  g_p = p;
  float d = ring(p, 1.7, 0.);
  g_p = p;
  p = bp;
  float dt = ring(p, 1.2, PI / 3.);
  g_p = dt < d ? p : g_p;
  d = min(d, dt);
  p = bp;
  dt = ring(p, 0.7, 2. * PI / 3.);
  g_p = dt < d ? p : g_p;
  return min(d, dt);
}
vec3 rotObj(vec3 p) {
  p.xz *= rot(tt / 2.);
  p.xy *= rot(tt / 3.);
  return p;
}

float map(vec3 p) {
  const float s = 4.;
  float tc = SIN(tt + PI);
  float d = 1e9;
  float twtz = SIN(tt);
  if (uKaleidoscope > .5) {
    for (int i = 0; i < 2; i++) {
      p.x = abs(p.x) - 3.;
      p.xy *= rot(.5 * tt / 6. + (.05 * p.z * twtz + .04 * p.y * twtz));
    }
  }
  vec3 bp = p;
  p.z -= cos(tt) * 2.0; // was a 0..20 unit dolly; kept inside the sphere
  g_p = p;
  if (_has_cubes > .5) d = cubeGrid3d(rotObj(p), s, tt);
  float gd = smin(min(d, 100.), length(p) - 9. * SIN(tt), 4.);
  float ge = abs((gd + 2.) - 0.02) * 2.;
  ge *= ge;
  g_glow += 0.4 / (10. + ge * ge);
  p = bp;
  p.z -= (_rings_move - .5) * 4.;
  p = rotObj(p);
  float e = 1e9;
  if (_has_rings > .5) e = rings(p / s) * s;
  g_mat = e < d ? 1. : 0.;
  g_p = e < d ? p : g_p;
  return min(e, d) * .8;
}

vec3 tetraNormal(vec3 p, float h) {
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) + k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
}
float calcAO(vec3 p, vec3 n) {
  float sca = 2.0, occ = 0.0;
  for (int i = 0; i < 3; i++) {
    float hr = 0.01 + float(i) * 0.5 / 4.0;
    occ += (hr - map(n * hr + p)) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}
vec4 subsurface(vec3 o, vec3 dir) {
  vec3 p = o;
  float e = 0.0;
  for (int i = 0; i < 3; ++i) {
    float d = map(p);
    e += -d;
    if (d > -0.001) break;
    p -= d * dir;
  }
  return vec4(p, e);
}

void main() {
  vec3 ro, rd;
  float tNear, tFar;
  if (!boundedSphereRay(ro, rd, tNear, tFar)) discard;
  tt = 2. * uTime;
  g_glow = 0.0;
  g_mat = 0.0;
  g_id = vec3(0.0);
  _has_cubes = float(uMode < .5 || uMode > 1.5);
  _has_rings = float(uMode > .5);
  _rings_move = SIN(tt);

  vec3 fro = ro * CUBES_SCALE;
  float t = tNear * CUBES_SCALE;
  float tEnd = tFar * CUBES_SCALE;
  bool hit = false;
  float mat = 0.;
  for (int i = 0; i < 128; i++) {
    if (i >= uSteps) break;
    float d = map(fro + rd * t);
    mat = g_mat;
    if (abs(d) < 0.0005 * max(1.0, t)) {
      hit = true;
      break;
    }
    t += d;
    if (t > tEnd) break;
  }

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (hit) {
    alpha = 1.0;
    vec3 p = fro + rd * t;
    map(p);
    vec3 id = g_id;
    vec3 n = tetraNormal(p, 0.0035);
    vec3 lc1 = vec3(0.702, 1.000, 0.965), lc2 = vec3(1.000, 0.929, 0.678);
    vec3 l = boundedLightDirection(vec3(-.35, .2, .92));
    vec3 l2 = boundedLightDirection(vec3(.2, .2, -.96));
    float dif = max(dot(n, l), .0);
    float dif2 = max(dot(n, l2), .0);
    vec3 h = normalize(mix(-n, rd, 0.5));
    vec4 sv = subsurface(p + h * 0.02, rd);
    float sss3 = max(0.0, 1.0 - 3.0 * sv.w);
    float difO = dif;
    dif = mix(dif, sss3, 0.5);
    dif2 = mix(dif2, sss3, 0.5);
    vec3 light = .5 * (dif * lc1 + dif2 * lc2) + .1;
    float gradient = float(int(uColorMode + .5) == 1);
    float alternate = float(int(uColorMode + .5) == 2);
    col = light * getPalette(length(id) * (1. - mat) * alternate * .5 + .05 * difO + length(p) * gradient * 0.1 - .2 * tt * gradient + mat * .5 + uColorOffset) * 1.2;
    col = mix(col, col * calcAO(p, n), .4);
    col *= 1.3;
  }
  float glowOpacity = g_glow * (180.0 / float(uSteps)) * .3 * uGlow * 0.15;
  col += glowOpacity * mix(vec3(1), getPalette(.5 * length(rd.xy) - .5 * tt), .5);
  alpha = max(alpha, clamp(glowOpacity, 0., 1.));
  alpha *= boundedOcclusion(fro + rd * (hit ? t : tNear * CUBES_SCALE), CUBES_SCALE);
  if (alpha < 0.01) discard;
  gl_FragDepth = boundedFragDepth(fro + rd * (hit ? t : tFar * CUBES_SCALE), CUBES_SCALE);
  // shader-lab grades in display space; pow 2.2 gives linear output.
  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), alpha);
  #include <colorspace_fragment>
}
