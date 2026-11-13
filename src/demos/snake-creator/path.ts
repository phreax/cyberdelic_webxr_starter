// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
/**
 * Bezier path editing for the Snake Creator. Ported from shader-lab (Karleido) editorPath.ts
 * (MIT, with permission) and extended with closed loops and 3D stroke simplification.
 */
export type Point = { x: number; y: number; z: number };
export type Anchor = { point: Point; inHandle: Point; outHandle: Point };

export const MAX_ANCHORS = 48;

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp = (a: Point, b: Point, t: number): Point => add(a, scale(sub(b, a), t));
const length = (a: Point): number => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Point, b: Point): number => length(sub(a, b));

export const strokeLength = (points: readonly Point[]): number =>
  points.reduce((sum, point, i) => (i === 0 ? 0 : sum + distance(points[i - 1]!, point)), 0);

/** A stroke whose end returns near its start (and that is long enough to be a loop). */
export const isLoopStroke = (points: readonly Point[], threshold = 0.08): boolean =>
  points.length > 3 && distance(points[0]!, points[points.length - 1]!) <= threshold && strokeLength(points) > threshold * 4;

const segmentDistance = (p: Point, a: Point, b: Point): number => {
  const ab = sub(b, a);
  const denominator = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  if (denominator < 1e-12) return distance(p, a);
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / denominator));
  return distance(p, lerp(a, b, t));
};

/** Ramer-Douglas-Peucker in 3D: keeps the stroke's corners, drops jitter. */
export const simplifyStroke = (points: readonly Point[], epsilon = 0.01): Point[] => {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let worst = -1;
    let worstDistance = epsilon;
    for (let i = from + 1; i < to; i += 1) {
      const d = segmentDistance(points[i]!, points[from]!, points[to]!);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([from, worst], [worst, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

/**
 * Smooth handles for an anchor between `previous` and `next`: the tangent follows the neighbours,
 * and each handle is a third of its own segment's length. Uniform (Catmull-Rom 1/6) handles
 * overshoot next to short segments, which shows as sharp kinks once the snake is rendered.
 */
const smoothHandles = (point: Point, previous: Point, next: Point): Anchor => {
  const chord = sub(next, previous);
  const chordLength = length(chord);
  const dir = chordLength > 1e-9 ? scale(chord, 1 / chordLength) : { x: 0, y: 0, z: 0 };
  return {
    point: { ...point },
    inHandle: sub(point, scale(dir, distance(point, previous) / 3)),
    outHandle: add(point, scale(dir, distance(next, point) / 3)),
  };
};

/** Light Laplacian smoothing of a hand-drawn stroke (end points stay fixed). */
export const smoothStroke = (points: readonly Point[], iterations = 2): Point[] => {
  let current = [...points];
  for (let k = 0; k < iterations; k += 1) {
    current = current.map((p, i) =>
      i === 0 || i === current.length - 1
        ? p
        : scale(add(add(current[i - 1]!, scale(p, 2)), current[i + 1]!), 0.25),
    );
  }
  return current;
};

/**
 * Smooth path through every kept point. Closed paths wrap neighbours around; a duplicated end
 * point is dropped.
 */
export const fitPathFromStroke = (points: readonly Point[], { closed = false } = {}): Anchor[] => {
  let source = [...points];
  if (closed && source.length > 2 && distance(source[0]!, source[source.length - 1]!) < 1e-3) source.pop();
  const kept =
    source.length > MAX_ANCHORS
      ? Array.from({ length: MAX_ANCHORS }, (_, i) => source[Math.round((i * (source.length - 1)) / (MAX_ANCHORS - 1))]!)
      : source;
  const n = kept.length;
  return kept.map((point, i) => {
    const previous = closed ? kept[(i - 1 + n) % n]! : (kept[i - 1] ?? point);
    const next = closed ? kept[(i + 1) % n]! : (kept[i + 1] ?? point);
    return smoothHandles(point, previous, next);
  });
};

export const segmentCount = (path: readonly Anchor[], closed: boolean): number =>
  path.length < 2 ? 0 : closed ? path.length : path.length - 1;

/** Anchors carry their handles with them. */
export const moveAnchor = (path: readonly Anchor[], index: number, to: Point): Anchor[] =>
  path.map((anchor, i) => {
    if (i !== index) return anchor;
    const delta = sub(to, anchor.point);
    return { point: { ...to }, inHandle: add(anchor.inHandle, delta), outHandle: add(anchor.outHandle, delta) };
  });

/** Splits a segment at `t` without changing the curve (de Casteljau). Works on the closing segment. */
export const insertAnchor = (path: readonly Anchor[], segment: number, t: number, closed: boolean): Anchor[] => {
  if (segment < 0 || segment >= segmentCount(path, closed) || path.length >= MAX_ANCHORS) return [...path];
  const fromIndex = segment;
  const toIndex = (segment + 1) % path.length;
  const from = path[fromIndex]!;
  const to = path[toIndex]!;
  const p01 = lerp(from.point, from.outHandle, t);
  const p12 = lerp(from.outHandle, to.inHandle, t);
  const p23 = lerp(to.inHandle, to.point, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const split: Anchor = { point: lerp(p012, p123, t), inHandle: p012, outHandle: p123 };
  const next = path.map((anchor, i) =>
    i === fromIndex ? { ...anchor, outHandle: p01 } : i === toIndex ? { ...anchor, inHandle: p23 } : anchor,
  );
  next.splice(fromIndex + 1, 0, split);
  return next;
};

/** A snake needs two anchors: a delete that would leave fewer keeps the path unchanged. */
export const deleteAnchors = (path: readonly Anchor[], selection: ReadonlySet<number>): Anchor[] => {
  const kept = path.filter((_, i) => !selection.has(i));
  return kept.length >= 2 ? kept : [...path];
};

export const evaluateSegment = (path: readonly Anchor[], segment: number, t: number): Point => {
  const from = path[segment]!;
  const to = path[(segment + 1) % path.length]!;
  const u = 1 - t;
  return add(
    add(scale(from.point, u * u * u), scale(from.outHandle, 3 * u * u * t)),
    add(scale(to.inHandle, 3 * u * t * t), scale(to.point, t * t * t)),
  );
};

/**
 * Recompute the end anchors' handles after opening or closing a path, so the seam (closed) or the
 * ends (open) stay smooth. Two anchors close into an oval instead of a there-and-back line.
 */
export const refitEndHandles = (path: readonly Anchor[], closed: boolean): Anchor[] => {
  const n = path.length;
  if (n < 2) return [...path];
  if (closed && n === 2) {
    const [a, b] = [path[0]!.point, path[1]!.point];
    const d = sub(b, a);
    const span = length(d);
    const up = Math.abs(d.y) < 0.99 * span ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    const cross = { x: d.y * up.z - d.z * up.y, y: d.z * up.x - d.x * up.z, z: d.x * up.y - d.y * up.x };
    // Bezier semicircle: handle length 4/3 of the radius.
    const side = scale(cross, (0.667 * span) / (length(cross) || 1));
    return [
      { point: { ...a }, inHandle: sub(a, side), outHandle: add(a, side) },
      { point: { ...b }, inHandle: add(b, side), outHandle: sub(b, side) },
    ];
  }
  const smooth = (i: number): Anchor => {
    const anchor = path[i]!;
    const previous = closed ? path[(i - 1 + n) % n]!.point : (path[i - 1]?.point ?? anchor.point);
    const next = closed ? path[(i + 1) % n]!.point : (path[i + 1]?.point ?? anchor.point);
    return smoothHandles(anchor.point, previous, next);
  };
  return path.map((anchor, i) => (i === 0 || i === n - 1 ? smooth(i) : anchor));
};
