import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { effectiveTwist, gradientRepeats, twistAngle } from './snake-look.js';

describe('effectiveTwist()', () => {
  test('closed loops use whole turns', () => {
    assert({
      given: 'fractional twists on a closed loop and on an open path',
      should: 'snap to whole turns only when closed',
      actual: [effectiveTwist(1.3, true), effectiveTwist(2.6, true), effectiveTwist(1.3, false)],
      expected: [1, 3, 1.3],
    });
  });

  test('no jump when the crawl wraps', () => {
    const twist = effectiveTwist(2.4, true);
    const jump = twistAngle(twist, 1.05) - twistAngle(twist, 0.05); // same point, one lap apart
    assert({
      given: 'a closed loop whose crawl position wraps by one lap',
      should: 'land on the same frame angle (multiple of a full turn)',
      actual: Math.abs(Math.sin(jump / 2)) < 1e-9,
      expected: true,
    });
  });
});

describe('gradientRepeats()', () => {
  test('spread', () => {
    assert({
      given: 'spread 0.05, 0.5 and 0',
      should: 'repeat the gradient 1x, 10x along the body, never 0',
      actual: [gradientRepeats(0.05), gradientRepeats(0.5), gradientRepeats(0) > 0],
      expected: [1, 10, true],
    });
  });
});

import { MAX_SPHERES, sphereCount } from './snake-look.js';

describe('sphereCount()', () => {
  test('density', () => {
    const length = 1;
    const radius = 0.02;
    assert({
      given: 'density 0, 0.5 and 1 for a 1 m body of 2 cm radius',
      should: 'give one sphere, touching spheres (2.2 r spacing), and densely overlapping spheres (capped)',
      actual: [sphereCount(length, radius, 0), sphereCount(length, radius, 0.5), sphereCount(length, radius, 1)],
      expected: [1, Math.floor(length / (2.2 * radius)), Math.min(MAX_SPHERES, Math.floor(length / (0.55 * radius)))],
    });
  });

  test('cap', () => {
    assert({
      given: 'a very long, thin body at full density',
      should: 'never exceed the sphere budget',
      actual: sphereCount(10, 0.005, 1),
      expected: MAX_SPHERES,
    });
  });
});
