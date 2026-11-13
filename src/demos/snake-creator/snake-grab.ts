// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { CURVE_SAMPLES, type Curve } from './curve.js';

/** Test the authored path, rather than its broad bounding box, when a near grab starts. */
export const isNearSnakeCurve = (
  curve: Curve,
  point: { x: number; y: number; z: number },
  radius: number,
  mirrorDistance: number | null,
): boolean => {
  const data = curve.data;
  const radiusSq = radius * radius;
  const segments = curve.closed ? CURVE_SAMPLES : CURVE_SAMPLES - 1;
  const passes = mirrorDistance === null ? 1 : 2;
  for (let pass = 0; pass < passes; pass++) {
    const mirrored = pass === 1;
    const offset = mirrorDistance === null ? 0 : (mirrored ? -mirrorDistance : mirrorDistance) * 0.5;
    for (let i = 0; i < segments; i++) {
      const a = i * 4;
      const b = ((i + 1) % CURVE_SAMPLES) * 4;
      const ax = (mirrored ? -data[a]! : data[a]!) + offset;
      const bx = (mirrored ? -data[b]! : data[b]!) + offset;
      const ay = data[a + 1]!, by = data[b + 1]!;
      const az = data[a + 2]!, bz = data[b + 2]!;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const lengthSq = dx * dx + dy * dy + dz * dz;
      const t = lengthSq > 0 ? Math.max(0, Math.min(1,
        ((point.x - ax) * dx + (point.y - ay) * dy + (point.z - az) * dz) / lengthSq)) : 0;
      const x = point.x - ax - dx * t;
      const y = point.y - ay - dy * t;
      const z = point.z - az - dz * t;
      if (x * x + y * y + z * z <= radiusSq) return true;
    }
  }
  return false;
};
