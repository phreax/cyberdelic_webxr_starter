import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createParticleLayout, handForce } from './garden-math.js';

describe('handForce()', () => {
  test('falloff', () => {
    assert({
      given: 'particles at the hand, halfway, at and beyond the radius',
      should: 'feel full, partial, then no force',
      actual: [handForce(0, 0.3), handForce(0.15, 0.3), handForce(0.3, 0.3), handForce(0.6, 0.3)],
      expected: [1, 0.5, 0, 0],
    });
  });
});

describe('createParticleLayout()', () => {
  const bounds = { center: [0, 1.3, -1.2] as const, radius: [1.2, 0.6, 1] as const };

  test('deterministic', () => {
    const a = createParticleLayout(500, 42, bounds);
    const b = createParticleLayout(500, 42, bounds);
    const c = createParticleLayout(500, 7, bounds);

    assert({
      given: 'the same seed twice and a different seed',
      should: 'produce identical layouts for the same seed only',
      actual: [a.homes.every((v, i) => v === b.homes[i]), a.homes.every((v, i) => v === c.homes[i])],
      expected: [true, false],
    });
  });

  test('inside the garden', () => {
    const { homes, seeds } = createParticleLayout(2000, 1, bounds);
    let inside = true;
    for (let i = 0; i < 2000; i += 1) {
      const dx = (homes[i * 3]! - bounds.center[0]) / bounds.radius[0];
      const dy = (homes[i * 3 + 1]! - bounds.center[1]) / bounds.radius[1];
      const dz = (homes[i * 3 + 2]! - bounds.center[2]) / bounds.radius[2];
      if (dx * dx + dy * dy + dz * dz > 1 + 1e-6) inside = false;
    }

    assert({
      given: 'a layout',
      should: 'place every particle inside the garden ellipsoid with 4 seeds each',
      actual: { inside, seeds: seeds.length },
      expected: { inside: true, seeds: 8000 },
    });
  });
});
