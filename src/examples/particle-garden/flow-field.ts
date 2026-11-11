/**
 * Coarse 3D velocity field that hands stir (CPU side, uploaded as a small 3D texture each frame).
 * Cells hold xyz velocity (m/s) in RGBA texels; sampling mirrors GPU linear filtering with
 * texel centres at (i + 0.5) / n and clamp-to-edge.
 */
export type Vec3 = readonly [number, number, number];
export type FlowField = {
  size: [number, number, number];
  min: Vec3;
  max: Vec3;
  data: Float32Array;
};

export const MAX_FIELD_SPEED = 3;

export const createFlowField = (box: { min: Vec3; max: Vec3 }, size: [number, number, number]): FlowField => ({
  size,
  min: box.min,
  max: box.max,
  data: new Float32Array(size[0] * size[1] * size[2] * 4),
});

const index = (field: FlowField, x: number, y: number, z: number) => ((z * field.size[1] + y) * field.size[0] + x) * 4;

const cellCentre = (field: FlowField, axis: number, i: number) =>
  field.min[axis]! + ((i + 0.5) / field.size[axis]!) * (field.max[axis]! - field.min[axis]!);

/** Gaussian splat of a hand's velocity; speeds are capped so flinging never explodes the field. */
export const stampField = (field: FlowField, position: Vec3, velocity: Vec3, radius: number): void => {
  const [nx, ny, nz] = field.size;
  const r2 = radius * radius;
  for (let z = 0; z < nz; z += 1) {
    const dz = cellCentre(field, 2, z) - position[2];
    if (dz * dz > r2 * 4) continue;
    for (let y = 0; y < ny; y += 1) {
      const dy = cellCentre(field, 1, y) - position[1];
      if (dy * dy > r2 * 4) continue;
      for (let x = 0; x < nx; x += 1) {
        const dx = cellCentre(field, 0, x) - position[0];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2 * 4) continue;
        const w = Math.exp(-d2 / r2);
        const i = index(field, x, y, z);
        const vx = field.data[i]! + velocity[0] * w;
        const vy = field.data[i + 1]! + velocity[1] * w;
        const vz = field.data[i + 2]! + velocity[2] * w;
        const speed = Math.hypot(vx, vy, vz);
        const k = speed > MAX_FIELD_SPEED ? MAX_FIELD_SPEED / speed : 1;
        field.data[i] = vx * k;
        field.data[i + 1] = vy * k;
        field.data[i + 2] = vz * k;
      }
    }
  }
};

/** Exponential decay; `memory` is the time constant in seconds. */
export const decayField = (field: FlowField, dt: number, memory: number): void => {
  const factor = memory > 0 ? Math.exp(-dt / memory) : 0;
  for (let i = 0; i < field.data.length; i += 1) field.data[i] = field.data[i]! * factor;
};

export const sampleField = (field: FlowField, position: Vec3): [number, number, number] => {
  const coord = [0, 1, 2].map((axis) => {
    const n = field.size[axis]!;
    const u = (position[axis]! - field.min[axis]!) / (field.max[axis]! - field.min[axis]!);
    const t = Math.min(n - 1, Math.max(0, u * n - 0.5));
    const i0 = Math.floor(t);
    return { i0, i1: Math.min(n - 1, i0 + 1), f: t - i0 };
  });
  const out: [number, number, number] = [0, 0, 0];
  const [cx, cy, cz] = coord as [typeof coord[0], typeof coord[0], typeof coord[0]];
  for (const [x, wx] of [[cx.i0, 1 - cx.f], [cx.i1, cx.f]] as const) {
    for (const [y, wy] of [[cy.i0, 1 - cy.f], [cy.i1, cy.f]] as const) {
      for (const [z, wz] of [[cz.i0, 1 - cz.f], [cz.i1, cz.f]] as const) {
        const w = wx * wy * wz;
        if (w === 0) continue;
        const i = index(field, x, y, z);
        out[0] += field.data[i]! * w;
        out[1] += field.data[i + 1]! * w;
        out[2] += field.data[i + 2]! * w;
      }
    }
  }
  return out;
};
