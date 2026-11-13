/** Pure placement math for world-space panels. Panels face +Z, so facing a target is a Y rotation. */

export type Vec3 = readonly [number, number, number];

/** Y rotation (radians) that turns a +Z-facing panel at `from` toward `to`. */
export const yawToward = (from: Vec3, to: Vec3): number => Math.atan2(to[0] - from[0], to[2] - from[2]);

export type SummonOptions = {
  /** Horizontal distance from the head, metres. */
  distance?: number;
  /** How far below eye height the panel centre sits, metres. */
  drop?: number;
  /** Offset to the viewer's right, metres. */
  side?: number;
};

/** Comfortable spot in front of the viewer, using only the horizontal heading. */
export const summonPose = (
  head: { position: Vec3; forward: Vec3 },
  { distance = 0.6, drop = 0.15, side = 0 }: SummonOptions = {},
): { position: [number, number, number]; yaw: number } => {
  const [hx, hy, hz] = head.position;
  const length = Math.hypot(head.forward[0], head.forward[2]);
  const [fx, fz] = length > 1e-4 ? [head.forward[0] / length, head.forward[2] / length] : [0, -1];
  const position: [number, number, number] = [hx + fx * distance - fz * side, hy - drop, hz + fz * distance + fx * side];
  return { position, yaw: yawToward(position, head.position) };
};

/** Three fixed positions around the same viewer pose. Reusing the pose prevents
 * panels from walking farther away as demos or inspector pages change. */
export const consoleArcPoses = (head: { position: Vec3; forward: Vec3 }) => ({
  picker: summonPose(head, { distance: 0.95, drop: 0.22, side: -0.58 }),
  demo: summonPose(head, { distance: 0.95, drop: 0.22, side: 0 }),
  inspector: summonPose(head, { distance: 0.95, drop: 0.22, side: 0.58 }),
});
