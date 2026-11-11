/** Pure math shared by the Particle Garden (TS mirrors of the GLSL where they must agree). */

/** Hand influence 0..1: full at the hand, smooth falloff to 0 at `radius`. GLSL: 1.0 - smoothstep(0.0, r, d). */
export const handForce = (distance: number, radius: number): number => {
  if (radius <= 0) return 0;
  const t = Math.min(1, Math.max(0, distance / radius));
  return 1 - t * t * (3 - 2 * t);
};

/** mulberry32: small, fast, deterministic PRNG. */
export const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type GardenBounds = { center: readonly [number, number, number]; radius: readonly [number, number, number] };

/** Uniform particle homes inside the garden ellipsoid, plus 4 random seeds per particle. */
export const createParticleLayout = (count: number, seed: number, { center, radius }: GardenBounds) => {
  const random = seededRandom(seed);
  const homes = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    let x: number;
    let y: number;
    let z: number;
    do {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      z = random() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    homes[i * 3] = center[0] + x * radius[0];
    homes[i * 3 + 1] = center[1] + y * radius[1];
    homes[i * 3 + 2] = center[2] + z * radius[2];
    for (let k = 0; k < 4; k += 1) seeds[i * 4 + k] = random();
  }
  return { homes, seeds };
};

/** Mood palettes for interaction zones: [colour A, colour B]. */
export const GARDEN_MOODS = {
  Lagoon: ['#00D9C7', '#2E7BFF'],
  Ember: ['#FF9500', '#FF3D6E'],
  Aurora: ['#A879FF', '#3DFFB0'],
} as const;
export type GardenMood = keyof typeof GARDEN_MOODS;
