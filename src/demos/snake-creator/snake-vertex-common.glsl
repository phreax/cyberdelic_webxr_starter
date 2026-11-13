// SPDX-License-Identifier: CC-BY-NC-SA-4.0
uniform highp sampler2D uSnakeCurve;
uniform float uSnakeCurveLength;
uniform float uSnakeClosed;
uniform float uSnakeHead;
uniform float uSnakeTail;
uniform float uSnakeThickness;
uniform float uSnakeHeadTaper;
uniform float uSnakeTailTaper;
uniform float uSnakeHeadShape;
uniform float uSnakeProfile;
uniform float uSnakeTwist;
uniform float uSnakeTwistPhase;
uniform float uSnakeSphereCount;
uniform float uSnakeSphereSize;
varying vec2 vSnakeBody;
#ifndef SNAKE_GEOMETRY
#define SNAKE_GEOMETRY 0
#endif
#if SNAKE_GEOMETRY == 1
// Spheres strung along the body (shader-lab "spheres"): each vertex knows its sphere index.
attribute float snakeIndex;
attribute vec2 snakeFace;
#endif
// Body direction at the vertex (diffraction grooves run along it).
vec3 gSnakeForward;

const int SNAKE_SAMPLES = __CURVE_SAMPLES__;

// Float textures are not filterable everywhere, so interpolate texels by hand. Closed loops wrap.
vec3 snakeCurveRow(int row, float s) {
  float x;
  int i0;
  int i1;
  if (uSnakeClosed > 0.5) {
    x = fract(s) * float(SNAKE_SAMPLES);
    i0 = int(floor(x)) % SNAKE_SAMPLES;
    i1 = (i0 + 1) % SNAKE_SAMPLES;
  } else {
    x = clamp(s, 0.0, 1.0) * float(SNAKE_SAMPLES - 1);
    i0 = int(floor(x));
    i1 = min(i0 + 1, SNAKE_SAMPLES - 1);
  }
  return mix(texelFetch(uSnakeCurve, ivec2(i0, row), 0).xyz, texelFetch(uSnakeCurve, ivec2(i1, row), 0).xyz, x - floor(x));
}

float snakeBodyLength() {
  return max(abs(uSnakeHead - uSnakeTail) * uSnakeCurveLength, 1.0e-4);
}

vec2 snakeFiniteRadius(float b, float bodyLength) {
  // A taper never gets shorter than a hemisphere, so both ends always close.
  float cap = min(0.5, uSnakeThickness / bodyLength);
  float tail = clamp(b / max(uSnakeTailTaper, cap), 0.0, 1.0);
  float nose = clamp((1.0 - b) / max(uSnakeHeadTaper, cap), 0.0, 1.0);
  // Pointed tail, rounded nose.
  float radius = uSnakeThickness * (1.0 - (1.0 - tail) * (1.0 - tail)) * sqrt(nose * (2.0 - nose));
  // Head shape: a neck pinch, then a head that widens sideways and flattens toward the frame normal.
  float headSpan = clamp(6.0 * uSnakeThickness / bodyLength, cap, 0.3);
  float k = (1.0 - b) / headSpan;
  float bulge = k < 1.0 ? pow(sin(3.14159265 * clamp(k, 0.0, 1.0)), 0.7) : 0.0;
  float neck = exp(-pow((k - 1.15) / 0.3, 2.0));
  float headShape = uSnakeHeadTaper == 0.0 ? 0.0 : uSnakeHeadShape;
  radius *= 1.0 - 0.3 * headShape * neck;
  return radius * vec2(1.0 - 0.35 * headShape * bulge, 1.0 + 0.45 * headShape * bulge);
}

// Open paths pinch the body shut at the path ends; closed loops have no ends.
float snakeEndPinch(float s) {
  if (uSnakeClosed > 0.5) return 1.0;
  float reach = 4.0 * uSnakeThickness / max(uSnakeCurveLength, 1.0e-4);
  return smoothstep(0.0, reach, s) * smoothstep(0.0, reach, 1.0 - s);
}

vec2 snakeSection(float b) {
  return snakeFiniteRadius(b, snakeBodyLength()) * snakeEndPinch(mix(uSnakeTail, uSnakeHead, b));
}

// Frame at body parameter b. Forward runs tail to head, so the winding holds when Reverse swaps them.
void snakeFrame(float b, out vec3 center, out vec3 forward, out vec3 frameNormal, out vec3 binormal) {
  float s = mix(uSnakeTail, uSnakeHead, b);
  vec3 tangent = normalize(snakeCurveRow(1, s));
  frameNormal = snakeCurveRow(2, s);
  frameNormal = normalize(frameNormal - tangent * dot(frameNormal, tangent));
  center = snakeCurveRow(0, s);
  // Open paths: past either end the body continues straight along the end tangent.
  if (uSnakeClosed < 0.5) center += tangent * (s - clamp(s, 0.0, 1.0)) * uSnakeCurveLength;
  forward = uSnakeHead >= uSnakeTail ? tangent : -tangent;
  binormal = cross(forward, frameNormal);
  if (uSnakeTwist > 0.0) {
    float angle = 6.28318531 * uSnakeTwist * (s + uSnakeTwistPhase);
    vec3 normal = cos(angle) * frameNormal + sin(angle) * binormal;
    binormal = -sin(angle) * frameNormal + cos(angle) * binormal;
    frameNormal = normal;
  }
}

void snakeProfile(float around, out vec2 point, out vec2 faceNormal) {
  float angle = around * 6.28318531 + 3.14159265;
  point = vec2(cos(angle), sin(angle));
  faceNormal = point;
  if (uSnakeProfile < 3.0) return;
  float side = floor(around * uSnakeProfile);
  float t = fract(around * uSnakeProfile);
  float stepAngle = 6.28318531 / uSnakeProfile;
  float rotation = uSnakeProfile == 4.0 ? 0.78539816 : 0.52359878;
  float corner = side * stepAngle + 3.14159265 + rotation;
  point = mix(vec2(cos(corner), sin(corner)), vec2(cos(corner + stepAngle), sin(corner + stepAngle)), t);
  faceNormal = vec2(cos(corner + 0.5 * stepAngle), sin(corner + 0.5 * stepAngle));
}

#if SNAKE_GEOMETRY == 1
// A unit sphere at its anchor on the body, turned with the frame, sized by the body radius there.
void snakeDeform(vec3 local, out vec3 snakePosition, out vec3 snakeNormal) {
  float anchor = (snakeIndex + 0.5) / max(uSnakeSphereCount, 1.0);
  vec3 center, forward, frameNormal, binormal;
  snakeFrame(anchor, center, forward, frameNormal, binormal);
  vec2 section = snakeSection(anchor);
  float size = 0.5 * (section.x + section.y) * uSnakeSphereSize;
  mat3 frame = mat3(forward, frameNormal, binormal);
  snakePosition = center + frame * (local * size);
  snakeNormal = frame * local;
  gSnakeForward = forward;
  vSnakeBody = vec2(anchor * snakeBodyLength() + local.x * size, snakeFace.x);
}
#else
void snakeDeform(vec3 local, out vec3 snakePosition, out vec3 snakeNormal) {
  // Grid: x is the body parameter (tail 0 → head 1), y the angle around.
  float b = local.x;
  float around = local.y;
  vec2 profile, profileNormal;
  snakeProfile(around, profile, profileNormal);
  vec3 center, forward, frameNormal, binormal;
  snakeFrame(b, center, forward, frameNormal, binormal);
  vec2 radius = max(vec2(0.0), snakeSection(b));
  snakePosition = center + radius.x * profile.x * frameNormal + radius.y * profile.y * binormal;
  gSnakeForward = forward;

  vec3 sectionNormal = normalize(radius.y * profileNormal.x * frameNormal + radius.x * profileNormal.y * binormal + 1.0e-6 * frameNormal);
  float delta = 1.0 / 128.0;
  vec2 ahead = snakeSection(min(b + delta, 1.0));
  vec2 behind = snakeSection(max(b - delta, 0.0));
  float run = (min(b + delta, 1.0) - max(b - delta, 0.0)) * snakeBodyLength();
  float slope = 0.5 * ((ahead.x + ahead.y) - (behind.x + behind.y)) / max(run, 1.0e-6);
  vec2 normal2 = normalize(vec2(radius.y * profileNormal.x, radius.x * profileNormal.y) + vec2(1.0e-6, 0.0));
  float twistSlope = 6.28318531 * uSnakeTwist * sign(uSnakeHead - uSnakeTail) / max(uSnakeCurveLength, 1.0e-4)
    * dot(vec2(-radius.y * profile.y, radius.x * profile.x), normal2);
  snakeNormal = normalize(sectionNormal - (slope + twistSlope) * forward);
  vSnakeBody = vec2(b * snakeBodyLength(), around);
}
#endif
