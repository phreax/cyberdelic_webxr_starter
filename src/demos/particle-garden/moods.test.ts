import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { GARDEN_MOODS } from './garden-math.js';

describe('GARDEN_MOODS', () => {
  test('palettes', () => {
    assert({
      given: 'the garden moods',
      should: 'be Ember, Cyberdelic, Ethereal Garden and Rainbow',
      actual: [...GARDEN_MOODS],
      expected: ['Ember', 'Cyberdelic', 'Ethereal Garden', 'Rainbow'],
    });
  });
});
