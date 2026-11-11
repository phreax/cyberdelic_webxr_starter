import { segmentCount, type Anchor, type Point } from './path.js';

/**
 * Curve sampling for the GPU-bent snake. Ported from shader-lab (Karleido) curve.ts (MIT, with
 * permission): even arc-length resampling plus a rotation-minimising frame (double reflection,
 * Wang et al. 2008). Extended: closed loops wrap, and the frame's leftover twist at the seam is
 * spread evenly along the loop so the body texture never jumps.
 */
export const CURVE_SAMPLES = 256;
/** Rows of the curve texture: position, tangent, normal. */
export const CURVE_ROWS = 3;
const FLATTEN_STEPS = 64;

type Vec3 = [number, number, number];
export type Curve = { length: number; data: Float32Array; closed: boolean };

const v = (p: Point): Vec3 => [p.x, p.y, p.z];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scaleAdd = (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Rotate `a` around unit axis `k` by `angle` (Rodrigues). */
const rotate = (a: Vec3, k: Vec3, angle: number): Vec3 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kxa = cross(k, a);
  const kda = dot(k, a) * (1 - c);
  return [a[0] * c + kxa[0] * s + k[0] * kda, a[1] * c + kxa[1] * s + k[1] * kda, a[2] * c + kxa[2] * s + k[2] * kda];
};

const bezier = (p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [0, 1, 2].map((i) => a * p0[i]! + b * p1[i]! + c * p2[i]! + d * p3[i]!) as Vec3;
};

const flatten = (path: readonly Anchor[], closed: boolean) => {
  const points: Vec3[] = [v(path[0]!.point)];
  const lengths = [0];
  for (let s = 0; s < segmentCount(path, closed); s += 1) {
    const from = path[s]!;
    const to = path[(s + 1) % path.length]!;
    const [p0, p1, p2, p3] = [v(from.point), v(from.outHandle), v(to.inHandle), v(to.point)];
    for (let step = 1; step <= FLATTEN_STEPS; step += 1) {
      const point = bezier(p0, p1, p2, p3, step / FLATTEN_STEPS);
      const segment = Math.hypot(...sub(point, points[points.length - 1]!));
      if (segment < 1e-9) continue;
      points.push(point);
      lengths.push(lengths[lengths.length - 1]! + segment);
    }
  }
  return { points, lengths };
};

/** First normal: perpendicular to the tangent, as close to world up as possible. */
const initialNormal = (tangent: Vec3): Vec3 => {
  const up: Vec3 = Math.abs(tangent[1]) < 0.99 ? [0, 1, 0] : [0, 0, 1];
  return normalize(scaleAdd(up, tangent, -dot(up, tangent)));
};

/** Double-reflection step of the rotation-minimising frame from (x0, t0, n0) to (x1, t1). */
const transport = (x0: Vec3, t0: Vec3, n0: Vec3, x1: Vec3, t1: Vec3): Vec3 => {
  const v1 = sub(x1, x0);
  const c1 = dot(v1, v1);
  if (c1 < 1e-12) return n0;
  const rn = scaleAdd(n0, v1, (-2 / c1) * dot(v1, n0));
  const rt = scaleAdd(t0, v1, (-2 / c1) * dot(v1, t0));
  const v2 = sub(t1, rt);
  const c2 = dot(v2, v2);
  const next = c2 < 1e-12 ? rn : scaleAdd(rn, v2, (-2 / c2) * dot(v2, rn));
  return normalize(scaleAdd(next, t1, -dot(next, t1)));
};

export const sampleCurve = (path: readonly Anchor[], closed: boolean): Curve | null => {
  if (path.length < 2) return null;
  const { points, lengths } = flatten(path, closed);
  const total = lengths[lengths.length - 1]!;
  if (points.length < 2 || total < 1e-6) return null;

  // Closed loops: sample [0, 1) so the last sample sits one step before the (wrapped) first.
  const divisor = closed ? CURVE_SAMPLES : CURVE_SAMPLES - 1;
  const positions: Vec3[] = [];
  let cursor = 0;
  for (let i = 0; i < CURVE_SAMPLES; i += 1) {
    const target = (i / divisor) * total;
    while (cursor < lengths.length - 2 && lengths[cursor + 1]! < target) cursor += 1;
    const span = lengths[cursor + 1]! - lengths[cursor]!;
    const t = span > 0 ? Math.min(1, Math.max(0, (target - lengths[cursor]!) / span)) : 0;
    positions.push(scaleAdd(points[cursor]!, sub(points[cursor + 1]!, points[cursor]!), t));
  }

  const last = CURVE_SAMPLES - 1;
  const at = (i: number) => (closed ? positions[(i + CURVE_SAMPLES) % CURVE_SAMPLES]! : positions[Math.min(last, Math.max(0, i))]!);
  const tangents = positions.map((_, i) => normalize(sub(at(i + 1), at(i - 1))));

  const normals: Vec3[] = [initialNormal(tangents[0]!)];
  for (let i = 0; i < last; i += 1) {
    normals.push(transport(positions[i]!, tangents[i]!, normals[i]!, positions[i + 1]!, tangents[i + 1]!));
  }

  if (closed) {
    // Carry the frame across the seam, measure the leftover twist and spread it along the loop.
    const end = transport(positions[last]!, tangents[last]!, normals[last]!, positions[0]!, tangents[0]!);
    const t0 = tangents[0]!;
    const n0 = normals[0]!;
    const theta = Math.atan2(dot(cross(end, n0), t0), dot(end, n0));
    for (let i = 1; i < CURVE_SAMPLES; i += 1) normals[i] = rotate(normals[i]!, tangents[i]!, (theta * i) / CURVE_SAMPLES);
  }

  const data = new Float32Array(CURVE_ROWS * CURVE_SAMPLES * 4);
  [positions, tangents, normals].forEach((row, r) => row.forEach((value, i) => data.set(value, (r * CURVE_SAMPLES + i) * 4)));
  return { length: total, data, closed };
};
