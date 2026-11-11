import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createParameterStore } from '../../core/parameters/store.js';
import { activePreset, applyPreset, SCULPTURE_PRESETS } from './presets.js';

const createParams = () => {
  const params = createParameterStore();
  params.define('growth', { default: 0.5 });
  params.define('hue', { default: 0 });
  params.define('spin', { default: 0.2 });
  return params;
};

describe('applyPreset()', () => {
  test('named parameters only', () => {
    const params = createParams();
    params.set('spin', 0.9, 'ui');
    applyPreset(params, { growth: 0.8, hue: 0.3, unknown: 5 });

    assert({
      given: 'a preset naming some parameters plus an unknown one',
      should: 'set the named ones, keep the others and ignore the unknown',
      actual: params.snapshot(),
      expected: { growth: 0.8, hue: 0.3, spin: 0.9 },
    });
  });
});

describe('activePreset()', () => {
  const presets = { a: { growth: 0.8, hue: 0.3 }, b: { growth: 0.2 } };

  test('matching', () => {
    assert({
      given: 'values equal to one preset (within tolerance) and values matching none',
      should: 'name the matching preset, or undefined',
      actual: [
        activePreset({ growth: 0.8001, hue: 0.3, spin: 1 }, presets),
        activePreset({ growth: 0.5, hue: 0.3 }, presets),
      ],
      expected: ['a', undefined],
    });
  });
});

describe('SCULPTURE_PRESETS', () => {
  test('catalogue', () => {
    assert({
      given: 'the built-in presets',
      should: 'offer four named looks',
      actual: Object.keys(SCULPTURE_PRESETS).length,
      expected: 4,
    });
  });
});
