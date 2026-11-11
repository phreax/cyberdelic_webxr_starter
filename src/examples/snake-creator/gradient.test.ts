import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { buildGradientData, GRADIENT_SIZE, SNAKE_PALETTES } from './gradient.js';

describe('buildGradientData()', () => {
  const texel = (data: Uint8Array, i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];

  test('cyclic', () => {
    const data = buildGradientData(['#000000', '#ffffff']);
    const first = texel(data, 0);
    const last = texel(data, GRADIENT_SIZE - 1);

    assert({
      given: 'a black to white palette baked for repetition',
      should: 'start black, reach white halfway and come back near black, so repeats have no seam',
      actual: [first, Math.abs(texel(data, GRADIENT_SIZE / 2)[0]! - 255) <= 3, Math.abs(last[0]! - first[0]!) <= 3, last[3]],
      expected: [[0, 0, 0, 255], true, true, 255],
    });
  });
});

describe('SNAKE_PALETTES', () => {
  test('catalogue', () => {
    assert({
      given: 'the snake palettes',
      should: 'offer Ethereal Garden, Cyberdelic (shader-lab colours), Ocean and Amber',
      actual: [Object.keys(SNAKE_PALETTES), SNAKE_PALETTES.Cyberdelic],
      expected: [['Ethereal Garden', 'Cyberdelic', 'Ocean', 'Amber'], ['#2c1b69', '#6a00ff', '#a64aff', '#00e5ff']],
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
