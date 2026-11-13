// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { CURVE_SAMPLES, type Curve } from './curve.js';
import { isNearSnakeCurve } from './snake-grab.js';

const line: Curve = {
  closed: false, length: 1,
  data: Float32Array.from({ length: CURVE_SAMPLES * 4 * 3 }, (_, i) => {
    const sample = Math.floor(i / 4);
    return sample < CURVE_SAMPLES && i % 4 === 0 ? sample / (CURVE_SAMPLES - 1) : 0;
  }),
};

describe('snake near grab', () => {
  test('ignores empty space inside the path bounding box', () => {
    assert({ given: 'a hand near the path and another away from it', should: 'grab only at the path',
      actual: [isNearSnakeCurve(line, { x: 0.5, y: 0.07, z: 0 }, 0.1, null),
        isNearSnakeCurve(line, { x: 0.5, y: 0.25, z: 0 }, 0.1, null)], expected: [true, false] });
  });

  test('checks the reflected path at its actual mirror offset', () => {
    assert({ given: 'a snake mirrored across YZ', should: 'accept the mirror and reject the gap',
      actual: [isNearSnakeCurve(line, { x: -0.6, y: 0, z: 0 }, 0.08, 0.2),
        isNearSnakeCurve(line, { x: 0, y: 0, z: 0 }, 0.08, 0.2)], expected: [true, false] });
  });
});
