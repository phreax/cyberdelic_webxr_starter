// SPDX-License-Identifier: CC-BY-NC-SA-4.0
uniform int uSnakePattern;
// 0 = transparent (gaps cut out), 1 = gaps filled with the gradient at an offset × brightness (0 = black).
uniform int uSnakeBackgroundMode;
uniform float uSnakeBackgroundOffset;
uniform float uSnakeBackgroundBrightness;
uniform float uSnakeRepeats;
uniform float uSnakeCellLength;
uniform float uSnakeWidth;
uniform float uSnakeHilbertSharpness;
uniform float uSnakeBodyLength;
uniform sampler2D uSnakeGradient;
uniform float uSnakeGradientRepeats;
uniform float uSnakeGradientOffset;
uniform int uSnakeHilbertRound;
varying vec2 vSnakeBody;

const int SNAKE_HILBERT_SIZE = __HILBERT_SIZE__;

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

float snakeHilbertStroke(float distanceToLine, float position, float edge) {
  float halfWidth = 0.4 * uSnakeWidth;
  return 1.0 - smoothstep(halfWidth - edge, halfWidth + edge, distanceToLine);
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
  // Derivatives of the continuous cell coordinate: fract() jumps at tile seams would smear lines there.
  float edge = max(1.0e-5, (fwidth(cell.x) + fwidth(cell.y)) * float(SNAKE_HILBERT_SIZE))
    * mix(3.0, 1.0, clamp(uSnakeHilbertSharpness, 0.0, 1.0));
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

float snakeGradientT(vec2 body) {
  return body.x / max(uSnakeBodyLength, 1.0e-4) * uSnakeGradientRepeats + uSnakeGradientOffset;
}

// rgb = colour, a = pattern coverage (0 in the gaps between rings / Hilbert lines).
vec4 snakeBodyColor(vec2 body) {
  // Along the body in cells, around it in whole repeats (seamless wrap).
  vec2 cell = vec2(body.x / uSnakeCellLength, body.y * uSnakeRepeats);
  float coverage;
  if (uSnakePattern == __PATTERN_INDEX_HILBERT__) coverage = snakeHilbert(cell).x;
  else if (uSnakePattern == __PATTERN_INDEX_SOLID__) coverage = 1.0;
  else coverage = snakeRings(cell);
  float t = snakeGradientT(body);
  vec3 foreground = texture(uSnakeGradient, vec2(fract(t), 0.5)).rgb;
  if (uSnakeBackgroundMode == 0) return vec4(foreground, coverage);
  vec3 background = texture(uSnakeGradient, vec2(fract(t + uSnakeBackgroundOffset), 0.5)).rgb * uSnakeBackgroundBrightness;
  return vec4(mix(background, foreground, coverage), 1.0);
}
