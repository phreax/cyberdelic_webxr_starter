// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { DEFAULT_LOOK, effectiveTwist, gradientRepeats, snakeSectionAt, twistAngle } from './snake-look.js';

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
      should: 'repeat the gradient 1x and 10x, with zero spread selecting one solid color',
      actual: [gradientRepeats(0.05), gradientRepeats(0.5), gradientRepeats(0)],
      expected: [1, 10, 0],
    });
  });
});

describe('snakeSectionAt()', () => {
  test('links follow the core taper and open-path end pinch', () => {
    const section = { normal: 0, binormal: 0 };
    const sample = (b: number, path: number, closed: boolean) => {
      snakeSectionAt(b, path, 0.4, 1, DEFAULT_LOOK, closed, section);
      return section.normal;
    };
    const middle = sample(0.5, 0.5, true);
    const tail = sample(0.025, 0.5, true);
    const head = sample(0.975, 0.5, true);
    const outside = sample(0.5, -0.1, false);
    assert({
      given: 'link positions across the body and one beyond an open path end',
      should: 'shrink at both body ends and close at the path end',
      actual: [tail < middle, head < middle, outside],
      expected: [true, true, 0],
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
