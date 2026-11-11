import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createOscMonitor } from './osc-monitor.js';

describe('createOscMonitor()', () => {
  test('rates and last message', () => {
    const monitor = createOscMonitor({ window: 1 });
    for (let i = 0; i < 10; i += 1) monitor.record('/a', [i], i * 0.1);
    monitor.record('/b', ['x'], 0.95);
    const stats = monitor.stats(1);

    assert({
      given: 'ten /a messages over a second and one /b',
      should: 'report per-address rate over the window and the latest message',
      actual: {
        rates: stats.addresses.map(({ address, rate }) => [address, rate]),
        last: { address: stats.last?.address, args: stats.last?.args },
      },
      expected: { rates: [['/a', 10], ['/b', 1]], last: { address: '/b', args: ['x'] } },
    });
  });

  test('old messages', () => {
    const monitor = createOscMonitor({ window: 1 });
    monitor.record('/a', [1], 0);
    assert({
      given: 'a message older than the window',
      should: 'drop it from the rate',
      actual: monitor.stats(5).addresses.map(({ rate }) => rate),
      expected: [0],
    });
  });
});
