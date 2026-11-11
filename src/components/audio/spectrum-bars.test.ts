import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { spectrumBars } from './spectrum-bars.js';

describe('spectrumBars()', () => {
  test('aggregation', () => {
    const silent = spectrumBars(new Uint8Array(512), 8);
    const full = spectrumBars(new Uint8Array(512).fill(255), 8);

    assert({
      given: 'a silent and a full-scale spectrum',
      should: 'return the requested number of bars at 0 and 1',
      actual: [silent.length, Math.max(...silent), Math.min(...full)],
      expected: [8, 0, 1],
    });
  });

  test('log spacing', () => {
    const lowOnly = new Uint8Array(512);
    lowOnly.fill(255, 0, 4);
    const bars = spectrumBars(lowOnly, 8);

    assert({
      given: 'energy only in the lowest bins',
      should: 'light the first bar and leave the last dark (log-spaced)',
      actual: [bars[0], bars[7]],
      expected: [1, 0],
    });
  });
});
