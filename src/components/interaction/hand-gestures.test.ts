import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { oneHandTransformDelta, twoHandGesture } from './hand-gestures.js';

const round = (v: number) => Math.round(v * 1000) / 1000;

describe('twoHandGesture()', () => {
  test('pinch zoom', () => {
    const g = twoHandGesture([-0.1, 1, -0.5], [0.1, 1, -0.5], [-0.2, 1, -0.5], [0.2, 1, -0.5]);
    assert({
      given: 'two hands moving apart to twice their distance without turning',
      should: 'zoom by 2 and not rotate',
      actual: [round(g.scale), round(g.angle)],
      expected: [2, 0],
    });
  });

  test('rotate', () => {
    const g = twoHandGesture([-0.1, 1, -0.5], [0.1, 1, -0.5], [0, 1, -0.6], [0, 1, -0.4]);
    assert({
      given: 'two hands turning a quarter turn around the vertical axis at the same distance',
      should: 'rotate 90° about ±Y and keep the scale',
      actual: [round(g.scale), round(g.angle), round(Math.abs(g.axis[1]))],
      expected: [1, round(Math.PI / 2), 1],
    });
  });

  test('degenerate', () => {
    const g = twoHandGesture([0, 1, 0], [0, 1, 0], [0, 1, 0], [0.1, 1, 0]);
    assert({
      given: 'hands that started at the same point',
      should: 'not zoom or rotate',
      actual: [g.scale, g.angle],
      expected: [1, 0],
    });
  });
});

describe('oneHandTransformDelta()', () => {
  test('drag mapping', () => {
    const right = [1, 0, 0] as const;
    const up = [0, 1, 0] as const;
    assert({
      given: 'a hand dragged right/up, left/down, and toward the viewer',
      should: 'increase, decrease, and leave the transform unchanged',
      actual: [
        round(oneHandTransformDelta([0.1, 0.1, 0], right, up, 2)),
        round(oneHandTransformDelta([-0.1, 0, 0], right, up, 2)),
        round(oneHandTransformDelta([0, 0, 0.3], right, up, 2)),
      ],
      expected: [0.4, -0.2, 0],
    });
  });
});


