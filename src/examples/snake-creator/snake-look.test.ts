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
