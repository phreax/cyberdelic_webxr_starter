import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { axisConstraint, createGazeDwell, createProximityState } from './triggers.js';

describe('createProximityState()', () => {
  test('hysteresis', () => {
    const zone = createProximityState({ radius: 0.2, hysteresis: 0.03 });
    const events = [0.5, 0.19, 0.21, 0.19, 0.24, 0.5].map((distance) => zone.update(distance));

    assert({
      given: 'a hand jittering around the radius, then leaving',
      should: 'enter once, ignore jitter inside the hysteresis band, exit once',
      actual: events,
      expected: [null, 'enter', null, null, 'exit', null],
    });
  });
});

describe('createGazeDwell()', () => {
  test('dwell once', () => {
    const gaze = createGazeDwell({ dwell: 1, angle: 0.1 });
    const onTarget = 0.05;
    const away = 0.5;
    const frames = [
      gaze.update(onTarget, 0.6),
      gaze.update(onTarget, 0.6),
      gaze.update(onTarget, 0.6),
      gaze.update(away, 0.1),
      gaze.update(onTarget, 0.5),
    ];

    assert({
      given: 'gaze held past the dwell time, kept on target, then leaving and returning briefly',
      should: 'fire exactly once and reset when gaze leaves',
      actual: frames,
      expected: [false, true, false, false, false],
    });
  });
});

describe('axisConstraint()', () => {
  test('single axis', () => {
    assert({
      given: 'a start position and an x-axis range of ±0.2',
      should: 'allow only x to move',
      actual: axisConstraint([1, 2, 3], 'x', 0.2),
      expected: { translateMin: [0.8, 2, 3], translateMax: [1.2, 2, 3] },
    });
  });
});
