import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { buildGradientData, GRADIENT_SIZE } from './gradient.js';

describe('buildGradientData()', () => {
  test('stops', () => {
    const data = buildGradientData(['#000000', '#ffffff']);
    const texel = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];

    assert({
      given: 'a black to white palette',
      should: 'start black, end white, be grey in the middle, opaque everywhere',
      actual: [texel(0), texel(GRADIENT_SIZE - 1), Math.abs(texel(GRADIENT_SIZE / 2)[0]! - 128) <= 2],
      expected: [[0, 0, 0, 255], [255, 255, 255, 255], true],
    });
  });
});

import { patternCells } from './snake-glsl.js';

describe('patternCells()', () => {
  test('seamless wrap', () => {
    const scales = [0.3, 0.77, 1, 1.9, 5];
    assert({
      given: 'any pattern scale',
      should: 'use a whole number of repeats around the body (no seam)',
      actual: scales.every((scale) => Number.isInteger(patternCells('rings', scale, 0.02).repeats)),
      expected: true,
    });
  });
});
