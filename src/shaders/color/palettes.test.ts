import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { bakePalette, cosineRainbow, PALETTES, PALETTE_SIZE } from './palettes.js';

const round = (v: readonly number[]) => v.map((x) => Math.round(x * 100) / 100);

describe('cosineRainbow()', () => {
  test('shader-lab formula', () => {
    assert({
      given: 't = 0 and t = 1',
      should: 'match 0.5 + 0.5·cos(2πt + (0, 2, 4)) and repeat every unit',
      actual: [round(cosineRainbow(0)), round(cosineRainbow(1))],
      expected: [round([1, 0.5 + 0.5 * Math.cos(2), 0.5 + 0.5 * Math.cos(4)]), round([1, 0.5 + 0.5 * Math.cos(2), 0.5 + 0.5 * Math.cos(4)])],
    });
  });
});

describe('bakePalette()', () => {
  test('generative rainbow', () => {
    const data = bakePalette('Rainbow');
    const texel = (i: number) => [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!];
    const first = texel(0);
    const last = texel(PALETTE_SIZE - 1);
    assert({
      given: 'the rainbow palette',
      should: 'bake the cosine rainbow, opaque, wrapping smoothly',
      actual: [first[0], first[3], Math.abs(last[0] - first[0]) <= 3],
      expected: [255, 255, true],
    });
  });

  test('catalogue', () => {
    assert({
      given: 'the shared palettes',
      should: 'include the shader-lab palettes, Ocean, Ember and the generative Rainbow',
      actual: ['Ethereal Garden', 'Cyberdelic', 'Ocean', 'Ember', 'Rainbow'].every((name) => name in PALETTES),
      expected: true,
    });
  });
});
