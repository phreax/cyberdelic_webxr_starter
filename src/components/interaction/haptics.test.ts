import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createHaptics, HAPTIC_PATTERNS } from './haptics.js';

const createActuatorLog = () => {
  const log: Array<[string, number, number]> = [];
  const actuatorFor = (hand: 'left' | 'right') =>
    hand === 'right'
      ? { pulse: async (intensity: number, duration: number) => void log.push([hand, intensity, duration]) }
      : undefined;
  return { log, actuatorFor };
};

// Runs scheduled callbacks immediately and records their delays.
const createImmediateScheduler = () => {
  const delays: number[] = [];
  const schedule = (fn: () => void, ms: number) => {
    delays.push(ms);
    fn();
  };
  return { delays, schedule };
};

describe('haptics.pulse()', () => {
  test('supported controller', () => {
    const { log, actuatorFor } = createActuatorLog();
    const haptics = createHaptics({ actuatorFor });

    assert({
      given: 'a controller with a haptic actuator',
      should: 'play the pulse and report it',
      actual: { played: haptics.pulse('right', { intensity: 0.5, duration: 80 }), log },
      expected: { played: true, log: [['right', 0.5, 80]] },
    });
  });

  test('graceful fallback', () => {
    const { log, actuatorFor } = createActuatorLog();
    const haptics = createHaptics({ actuatorFor });

    assert({
      given: 'a hand or controller without an actuator',
      should: 'do nothing and report that no pulse played',
      actual: { played: haptics.pulse('left', { intensity: 0.5, duration: 80 }), log },
      expected: { played: false, log: [] },
    });
  });

  test('intensity clamp', () => {
    const { log, actuatorFor } = createActuatorLog();
    createHaptics({ actuatorFor }).pulse('right', { intensity: 3, duration: 10 });

    assert({
      given: 'an intensity above 1',
      should: 'clamp it to 1',
      actual: log[0]?.[1],
      expected: 1,
    });
  });
});

describe('haptics.play()', () => {
  test('patterns', () => {
    assert({
      given: 'the pattern catalogue',
      should: 'provide click, select, grab, release and impact',
      actual: Object.keys(HAPTIC_PATTERNS).sort(),
      expected: ['click', 'grab', 'impact', 'release', 'select'],
    });
  });

  test('multi-pulse sequence', () => {
    const { log, actuatorFor } = createActuatorLog();
    const { delays, schedule } = createImmediateScheduler();
    createHaptics({ actuatorFor, schedule }).play('right', 'impact');

    const pattern = HAPTIC_PATTERNS.impact;
    assert({
      given: 'a multi-pulse pattern',
      should: 'play every pulse in order, each after its delay',
      actual: { pulses: log.map(([, i, d]) => [i, d]), delays },
      expected: {
        pulses: pattern.map((p) => [p.intensity, p.duration]),
        delays: pattern.map((p) => p.delay ?? 0),
      },
    });
  });
});
