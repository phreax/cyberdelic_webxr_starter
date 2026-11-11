import { CURVE_SAMPLES } from './curve.js';

/**
 * Snake GLSL, ported from shader-lab (Karleido) snakeGlsl.ts + pattern.ts (MIT, with permission).
 * Kept: tube body bent along the curve texture, tapers, head shape, round/square/hex profile,
 * twist, rings / hilbert / solid patterns with gradient. Removed: stage occlusion, holes, slices,
 * spheres, streaming. Added: closed loops (curve lookups wrap; no end pinch).
 */
export const HILBERT_SIZE = 8;
export const PATTERN_INDEX = { rings: 0, hilbert: 1, solid: 3 } as const;
export type SnakePattern = keyof typeof PATTERN_INDEX;

export const SNAKE_VERTEX_COMMON = /* glsl */ `
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
varying vec2 vSnakeBody;

const int SNAKE_SAMPLES = ${CURVE_SAMPLES};

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
`;

export const SNAKE_FRAGMENT_COMMON = /* glsl */ `
uniform vec3 uSnakeForeground;
uniform vec3 uSnakeBackground;
uniform int uSnakePattern;
uniform float uSnakeRepeats;
uniform float uSnakeCellLength;
uniform float uSnakeWidth;
uniform float uSnakeBodyLength;
uniform sampler2D uSnakeGradient;
uniform int uSnakeGradientMode;
uniform float uSnakeGradientRepeats;
uniform int uSnakeHilbertRound;
uniform int uSnakeHilbertAnimate;
uniform float uSnakeHilbertPhase;
uniform float uSnakeHilbertLength;
uniform float uSnakeHilbertScale;
varying vec2 vSnakeBody;

const int SNAKE_HILBERT_SIZE = ${HILBERT_SIZE};

ivec2 snakeHilbertCell(int index) {
  int x = 0;
  int y = 0;
  int t = index;
  for (int s = 1; s < SNAKE_HILBERT_SIZE; s *= 2) {
    int rx = 1 & (t >> 1);
    int ry = 1 & (t ^ rx);
    if (ry == 0) {
      if (rx == 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      int swap = x;
      x = y;
      y = swap;
    }
    x += s * rx;
    y += s * ry;
    t >>= 2;
  }
  return ivec2(x, y);
}

int snakeHilbertIndex(ivec2 cell) {
  int x = cell.x;
  int y = cell.y;
  int index = 0;
  for (int s = SNAKE_HILBERT_SIZE / 2; s > 0; s /= 2) {
    int rx = (x & s) > 0 ? 1 : 0;
    int ry = (y & s) > 0 ? 1 : 0;
    index += s * s * ((3 * rx) ^ ry);
    if (ry == 0) {
      if (rx == 1) {
        x = SNAKE_HILBERT_SIZE - 1 - x;
        y = SNAKE_HILBERT_SIZE - 1 - y;
      }
      int swap = x;
      x = y;
      y = swap;
    }
  }
  return index;
}

vec2 snakeSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float t = clamp(dot(p - a, ba) / max(dot(ba, ba), 1.0e-6), 0.0, 1.0);
  return vec2(length(p - mix(a, b, t)), t);
}

float snakeHilbertTrail(float position, float edge) {
  if (uSnakeHilbertAnimate == 0 || uSnakeHilbertLength >= 1.0) return 1.0;
  if (uSnakeHilbertLength <= 0.0) return 0.0;
  float span = float(SNAKE_HILBERT_SIZE * SNAKE_HILBERT_SIZE);
  float offset = abs(fract(position / span * uSnakeHilbertScale - uSnakeHilbertPhase + 0.5 * uSnakeHilbertLength + 0.5) - 0.5);
  return 1.0 - smoothstep(0.5 * uSnakeHilbertLength - edge * uSnakeHilbertScale / span,
    0.5 * uSnakeHilbertLength + edge * uSnakeHilbertScale / span, offset);
}

float snakeHilbertStroke(float distanceToLine, float position, float edge) {
  float halfWidth = 0.4 * uSnakeWidth;
  return (1.0 - smoothstep(halfWidth - edge, halfWidth + edge, distanceToLine)) * snakeHilbertTrail(position, edge);
}

vec2 snakeHilbert(vec2 cell) {
  if (uSnakeWidth <= 0.0) return vec2(0.0);
  vec2 grid = fract(cell) * float(SNAKE_HILBERT_SIZE);
  ivec2 here = ivec2(floor(grid));
  int index = snakeHilbertIndex(here);
  vec2 local = fract(grid);
  vec2 centre = vec2(0.5);
  vec2 previous = vec2(0.0), next = vec2(0.0);
  if (index > 0) previous = vec2(snakeHilbertCell(index - 1) - here);
  if (index < SNAKE_HILBERT_SIZE * SNAKE_HILBERT_SIZE - 1) next = vec2(snakeHilbertCell(index + 1) - here);
  bool roundCorner = uSnakeHilbertRound == 1 && index > 0
    && index < SNAKE_HILBERT_SIZE * SNAKE_HILBERT_SIZE - 1 && dot(previous, next) == 0.0;
  float trim = roundCorner ? 0.25 : 0.0;
  float edge = max(1.0e-5, fwidth(grid.x) + fwidth(grid.y));
  vec2 nearest = vec2(1.0e5, float(index));
  if (index > 0) {
    vec2 hit = snakeSegment(local, centre + 0.5 * previous, centre + trim * previous);
    nearest = vec2(hit.x, float(index) + mix(-0.5, -trim, hit.y));
  }
  if (index < SNAKE_HILBERT_SIZE * SNAKE_HILBERT_SIZE - 1) {
    vec2 hit = snakeSegment(local, centre + trim * next, centre + 0.5 * next);
    if (hit.x < nearest.x) nearest = vec2(hit.x, float(index) + mix(trim, 0.5, hit.y));
  }
  if (roundCorner) {
    vec2 arcCentre = centre + trim * (previous + next);
    vec2 q = local - arcCentre;
    float angle = clamp(atan(dot(q, -previous), dot(q, -next)), 0.0, 1.57079633);
    vec2 onArc = arcCentre - trim * (cos(angle) * next + sin(angle) * previous);
    float position = float(index) + mix(-trim, trim, angle / 1.57079633);
    float arcDistance = length(local - onArc);
    if (arcDistance < nearest.x) nearest = vec2(arcDistance, position);
  }
  return vec2(snakeHilbertStroke(nearest.x, nearest.y, edge), nearest.y);
}

float snakeRings(vec2 cell) {
  if (uSnakeWidth <= 0.0) return 0.0;
  if (uSnakeWidth >= 1.0) return 1.0;
  float offset = abs(fract(cell.x) - 0.5);
  float edge = fwidth(cell.x);
  return 1.0 - smoothstep(0.5 * uSnakeWidth - edge, 0.5 * uSnakeWidth + edge, offset);
}

vec3 snakeForeground(vec2 body, vec3 solid) {
  if (uSnakeGradientMode == 0) return solid;
  float t = body.x / max(uSnakeBodyLength, 1.0e-4);
  return texture(uSnakeGradient, vec2(fract(t * uSnakeGradientRepeats), 0.5)).rgb;
}

vec3 snakeBodyColor(vec2 body, vec3 foreground) {
  // Along the body in cells, around it in whole repeats (seamless wrap).
  vec2 cell = vec2(body.x / uSnakeCellLength, body.y * uSnakeRepeats);
  float coverage;
  vec3 color = snakeForeground(body, foreground);
  if (uSnakePattern == ${PATTERN_INDEX.hilbert}) coverage = snakeHilbert(cell).x;
  else if (uSnakePattern == ${PATTERN_INDEX.solid}) coverage = 1.0;
  else coverage = snakeRings(cell);
  return mix(uSnakeBackground, color, coverage);
}
`;

/** Cells around the body; whole repeats keep the wrap seamless; cells stay square on the body. */
const BASE_REPEATS: Record<SnakePattern, number> = { rings: 4, hilbert: 1, solid: 1 };
export const patternCells = (pattern: SnakePattern, scale: number, radius: number) => {
  const repeats = Math.max(1, Math.round(BASE_REPEATS[pattern] / Math.max(0.1, scale)));
  return { repeats, cellLength: (2 * Math.PI * radius) / repeats };
};
