import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { knobAngleDeg, knobValueFromDrag, sliderValueFromLocalX } from './control-math.js';

const range = { min: 0, max: 10, step: 1 };

describe('sliderValueFromLocalX()', () => {
  test('track mapping', () => {
    assert({
      given: 'the track ends and centre (local x -0.5, 0, 0.5)',
      should: 'map to min, middle and max',
      actual: [-0.5, 0, 0.5].map((x) => sliderValueFromLocalX(x, range)),
      expected: [0, 5, 10],
    });

    assert({
      given: 'a pointer beyond the track',
      should: 'clamp to the range',
      actual: [sliderValueFromLocalX(-2, range), sliderValueFromLocalX(2, range)],
      expected: [0, 10],
    });

    assert({
      given: 'a position between steps',
      should: 'snap to the nearest step',
      actual: sliderValueFromLocalX(0.07, range),
      expected: 6,
    });
  });
});

describe('knobValueFromDrag()', () => {
  test('drag mapping', () => {
    const knob = { min: 0, max: 1, step: 0, sensitivity: 2 };

    assert({
      given: 'an upward drag of a quarter knob height from 0.25',
      should: 'raise the value by sensitivity × drag',
      actual: knobValueFromDrag(0.25, 0.25, knob),
      expected: 0.75,
    });

    assert({
      given: 'a drag far past the end',
      should: 'clamp to the range',
      actual: [knobValueFromDrag(0.5, 10, knob), knobValueFromDrag(0.5, -10, knob)],
      expected: [1, 0],
    });
  });
});

describe('knobAngleDeg()', () => {
  test('sweep', () => {
    assert({
      given: 'min, middle and max values',
      should: 'map onto a 270° sweep centred at the top',
      actual: [0, 5, 10].map((v) => knobAngleDeg(v, range)),
      expected: [135, 0, -135],
    });
  });
});
