import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createPressTracker } from './press.js';

describe('createPressTracker()', () => {
  test('slow XR press', () => {
    const press = createPressTracker({ maxMs: 1500 });
    press.down(1, 0);
    assert({
      given: 'a press released after 800 ms (slower than the 300 ms pointer-events click)',
      should: 'count as an activation',
      actual: press.up(1, 800),
      expected: true,
    });
  });

  test('rejections', () => {
    const tooLong = createPressTracker({ maxMs: 1500 });
    tooLong.down(1, 0);
    const otherPointer = createPressTracker();
    otherPointer.down(1, 0);
    const cancelled = createPressTracker();
    cancelled.down(1, 0);
    cancelled.cancel();
    const noDown = createPressTracker();

    assert({
      given: 'a press held too long, released by another pointer, cancelled by leaving, or never pressed',
      should: 'not activate',
      actual: [tooLong.up(1, 2000), otherPointer.up(2, 100), cancelled.up(1, 100), noDown.up(1, 100)],
      expected: [false, false, false, false],
    });
  });

  test('single activation', () => {
    const press = createPressTracker();
    press.down(1, 0);
    assert({
      given: 'one press and two releases',
      should: 'activate only once',
      actual: [press.up(1, 100), press.up(1, 150)],
      expected: [true, false],
    });
  });
});
