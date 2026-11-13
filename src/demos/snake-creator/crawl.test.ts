// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { crawlAt } from './crawl.js';

describe('crawlAt()', () => {
  test('open path cycle', () => {
    const settings = { speed: 0.5, length: 0.3, closed: false, reverse: false };
    const cycle = (1 + 0.3) / 0.5;
    const start = crawlAt(0, settings);
    const end = crawlAt(cycle * 0.999, settings);

    assert({
      given: 'an open path over one cycle',
      should: 'start with the head entering at 0 and end with the tail leaving at 1',
      actual: [start.head, start.tail, end.tail > 0.99],
      expected: [0, -0.3, true],
    });
  });

  test('closed loop', () => {
    const settings = { speed: 0.5, length: 0.3, closed: true, reverse: false };
    const lengths = [0, 1.7, 5.3, 100].map((t) => {
      const c = crawlAt(t, settings);
      return Math.round((c.head - c.tail) * 1000) / 1000;
    });

    assert({
      given: 'a closed loop at any time',
      should: 'keep the whole body on the path (endless crawl, no entry or exit)',
      actual: lengths,
      expected: [0.3, 0.3, 0.3, 0.3],
    });
  });

  test('reverse', () => {
    // Shortest signed step around the loop (positions wrap at 1).
    const step = (reverse: boolean) => {
      const settings = { speed: 0.5, length: 0.3, closed: true, reverse };
      const d = crawlAt(0.1, settings).head - crawlAt(0, settings).head;
      return Math.sign(((d % 1) + 1.5) % 1 - 0.5);
    };

    assert({
      given: 'reverse on a closed loop',
      should: 'move the head the other way around the loop',
      actual: [step(false), step(true)],
      expected: [1, -1],
    });
  });
});
