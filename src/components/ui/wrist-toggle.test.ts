import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createWristToggle } from './wrist-toggle.js';

const run = (frames: Array<[pressed: boolean, now: number]>) => {
  const toggle = createWristToggle();
  return frames.map(([pressed, now]) => toggle.update(pressed, now));
};

describe('wrist toggle button', () => {
  test('a touch or aimed press toggles once', () => {
    assert({ given: 'the button pressed for several frames, then released', should: 'fire on the first pressed frame only',
      actual: run([[false, 0], [true, 1000], [true, 1016], [true, 1032], [false, 1048]]), expected: [false, true, false, false, false] });
  });

  test('presses closer than the debounce are ignored', () => {
    assert({ given: 'a second press 200 ms after the first', should: 'not toggle the menu back',
      actual: run([[true, 1000], [false, 1100], [true, 1200], [false, 1300], [true, 1700]]), expected: [true, false, false, false, true] });
  });

  test('hover without a press never toggles', () => {
    assert({ given: 'no press (e.g. a pinch elsewhere while the ray hovers the button)', should: 'never fire',
      actual: run([[false, 1000], [false, 2000]]), expected: [false, false] });
  });
});
