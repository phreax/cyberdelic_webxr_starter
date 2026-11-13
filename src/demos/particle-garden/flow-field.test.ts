import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createFlowField, decayField, sampleField, stampField } from './flow-field.js';

const box = { min: [-1, 0, -2] as const, max: [1, 2, 0] as const };
const round = (v: readonly number[]) => v.map((x) => Math.round(x * 1000) / 1000);

describe('flow field', () => {
  test('stamp and sample', () => {
    const field = createFlowField(box, [12, 12, 12]);
    stampField(field, [0, 1, -1], [1, 0, 0], 0.3);
    const at = sampleField(field, [0, 1, -1]);
    const far = sampleField(field, [0.9, 0.1, -1.9]);

    assert({
      given: 'a hand moving +x through the centre',
      should: 'leave +x velocity there and nothing far away',
      actual: [at[0] > 0.5, Math.abs(at[1]) < 1e-6, Math.abs(far[0]) < 1e-3],
      expected: [true, true, true],
    });
  });

  test('field memory', () => {
    const field = createFlowField(box, [8, 8, 8]);
    stampField(field, [0, 1, -1], [1, 0, 0], 0.4);
    const before = sampleField(field, [0, 1, -1])[0];
    decayField(field, Math.LN2 * 2, 2); // one half-life for memory = 2 s
    const after = sampleField(field, [0, 1, -1])[0];

    assert({
      given: 'one half-life of decay',
      should: 'halve the stirred velocity',
      actual: Math.round((after / before) * 100) / 100,
      expected: 0.5,
    });
  });

  test('trilinear like GPU filtering', () => {
    const field = createFlowField(box, [2, 1, 1]);
    // cell centres at x = -0.5 and +0.5
    field.data[0] = 0;
    field.data[4] = 2;
    assert({
      given: 'two cells with 0 and 2, sampled between their centres and beyond the edge',
      should: 'interpolate linearly and clamp at the edges',
      actual: round([sampleField(field, [0, 1, -1])[0], sampleField(field, [-0.9, 1, -1])[0], sampleField(field, [0.9, 1, -1])[0]]),
      expected: [1, 0, 2],
    });
  });

  test('speed cap', () => {
    const field = createFlowField(box, [8, 8, 8]);
    for (let i = 0; i < 50; i += 1) stampField(field, [0, 1, -1], [5, 0, 0], 0.4);
    assert({
      given: 'a hand flung repeatedly through the same spot',
      should: 'cap the stored speed',
      actual: sampleField(field, [0, 1, -1])[0] <= 3 + 1e-6,
      expected: true,
    });
  });
});
