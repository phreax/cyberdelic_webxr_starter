import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createFpsMeter } from './fps-meter.js';

describe('createFpsMeter()', () => {
  test('sliding window average', () => {
    const meter = createFpsMeter({ window: 1 });
    for (let i = 0; i < 72; i += 1) meter.push(1 / 72);
    const steady = Math.round(meter.fps());
    meter.push(0.5); // one long hitch
    const afterHitch = Math.round(meter.fps());

    assert({
      given: 'a second at 72 fps, then one 500 ms hitch',
      should: 'report 72, then an averaged drop instead of a single-frame 2 fps',
      actual: [steady, afterHitch > 10 && afterHitch < 72],
      expected: [72, true],
    });
  });

  test('empty', () => {
    assert({
      given: 'no frames yet',
      should: 'report 0',
      actual: createFpsMeter().fps(),
      expected: 0,
    });
  });
});
