import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { matchAddress, normalizeInput, reconnectDelay } from './osc-utils.js';

describe('matchAddress()', () => {
  test('wildcards', () => {
    assert({
      given: 'exact, * and ? patterns',
      should: 'match within one address part only',
      actual: [
        matchAddress('/visual/intensity', '/visual/intensity'),
        matchAddress('/visual/*', '/visual/intensity'),
        matchAddress('/visual/*', '/visual/a/b'),
        matchAddress('/layer?/x', '/layer2/x'),
        matchAddress('/layer?/x', '/layer22/x'),
      ],
      expected: [true, true, false, true, false],
    });
  });
});

describe('normalizeInput()', () => {
  test('ranges', () => {
    assert({
      given: 'a MIDI-style 0..127 value mapped into a 0..1 parameter',
      should: 'rescale and clamp',
      actual: [normalizeInput(127, [0, 127], [0, 1]), normalizeInput(63.5, [0, 127], [0, 1]), normalizeInput(500, [0, 127], [0, 1])],
      expected: [1, 0.5, 1],
    });
  });
});

describe('reconnectDelay()', () => {
  test('backoff', () => {
    assert({
      given: 'successive reconnect attempts',
      should: 'double the delay up to the cap',
      actual: [0, 1, 2, 3, 10].map((attempt) => reconnectDelay(attempt, { base: 500, max: 4000 })),
      expected: [500, 1000, 2000, 4000, 4000],
    });
  });
});
