/** Pure hand-gesture math (positions in world metres), used by createObjectGestures(). */
export type Vec3 = readonly [number, number, number];

const sub = (a: Vec3, b: Vec3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/**
 * Two pinching hands: zoom = change of hand distance, rotation = turn of the hand-to-hand
 * vector (axis-angle, world space) between the previous and current frame.
 */
export const twoHandGesture = (prevA: Vec3, prevB: Vec3, curA: Vec3, curB: Vec3) => {
  const before = sub(prevB, prevA);
  const after = sub(curB, curA);
  const lb = length(before);
  const la = length(after);
  if (lb < 1e-4 || la < 1e-4) return { scale: 1, axis: [0, 1, 0] as [number, number, number], angle: 0 };
  const axis = cross(before, after);
  const al = length(axis);
  const angle = Math.atan2(al, dot(before, after));
  return {
    scale: la / lb,
    axis: (al > 1e-9 ? [axis[0] / al, axis[1] / al, axis[2] / al] : [0, 1, 0]) as [number, number, number],
    angle: al > 1e-9 ? angle : 0,
  };
};

/** One grabbing hand: drag right / up increases the transform, left / down decreases it. */
export const oneHandTransformDelta = (delta: Vec3, right: Vec3, up: Vec3, gain: number): number =>
  (dot(delta, right) + dot(delta, up)) * gain;

