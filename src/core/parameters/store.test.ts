import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createParameterStore } from './store.js';

const createGrowth = (smoothing = 0) => {
  const params = createParameterStore();
  params.define('growth', { default: 0.5, min: 0, max: 1, smoothing });
  return params;
};

const signal = (initial = 0) => {
  let value = initial;
  return { read: () => value, write: (next: number) => void (value = next) };
};

describe('parameter registry', () => {
  test('defaults and clamping', () => {
    const params = createGrowth();
    const initial = params.get('growth');
    params.set('growth', 3);
    params.update(0.016);

    assert({
      given: 'a defined parameter, then a value above its range',
      should: 'start at the default and clamp the new value to max',
      actual: [initial, params.get('growth')],
      expected: [0.5, 1],
    });
  });

  test('smoothing', () => {
    const params = createGrowth(0.2);
    params.set('growth', 1);
    params.update(0.05);
    const partway = params.get('growth');
    for (let i = 0; i < 200; i += 1) params.update(0.05);

    assert({
      given: 'smoothing and a new target',
      should: 'move part of the way per frame and converge on the target',
      actual: [partway > 0.5 && partway < 1, Math.abs(params.get('growth') - 1) < 1e-6],
      expected: [true, true],
    });
  });

  test('subscribers', () => {
    const params = createGrowth();
    const seen: Array<[number, string]> = [];
    const off = params.subscribe('growth', (value, source) => void seen.push([value, source]));
    params.set('growth', 0.8, 'osc');
    off();
    params.set('growth', 0.2, 'ui');

    assert({
      given: 'a base value change, then unsubscribing',
      should: 'notify with value and source only while subscribed',
      actual: seen,
      expected: [[0.8, 'osc']],
    });
  });

  test('unknown ids', () => {
    const params = createGrowth();
    params.apply({ growth: 0.9, missing: 1 });
    params.update(0);

    assert({
      given: 'a batch with an unknown parameter',
      should: 'apply known ids and ignore the rest',
      actual: [params.get('growth'), params.has('missing')],
      expected: [0.9, false],
    });
  });
});

describe('modulation', () => {
  test('deterministic order', () => {
    const run = (order: Array<'replace' | 'add' | 'multiply'>) => {
      const params = createGrowth();
      params.set('growth', 0.2);
      const configs = {
        replace: { read: () => 0.4, mode: 'replace' as const, amount: 1 },
        add: { read: () => 1, mode: 'add' as const, amount: 0.1 },
        multiply: { read: () => 1, mode: 'multiply' as const, amount: 1 },
      };
      for (const mode of order) params.modulate('growth', configs[mode]);
      params.update(0);
      return Math.round(params.get('growth') * 1000) / 1000;
    };

    assert({
      given: 'replace, add and multiply modulators registered in different orders',
      should: 'always compute ((replace) + add) × multiply',
      actual: [run(['replace', 'add', 'multiply']), run(['multiply', 'add', 'replace'])],
      expected: [1, 1],
    });
  });

  test('input range and amount', () => {
    const params = createGrowth();
    params.set('growth', 0);
    const bass = signal(0.5);
    params.modulate('growth', { read: bass.read, mode: 'add', amount: 0.4, inputRange: [0, 0.5] });
    params.update(0);

    assert({
      given: 'a signal at the top of its input range and amount 0.4',
      should: 'add 40% of the parameter range',
      actual: params.get('growth'),
      expected: 0.4,
    });
  });

  test('trigger', () => {
    const params = createGrowth();
    params.set('growth', 0);
    const beat = signal(0);
    params.modulate('growth', { read: beat.read, mode: 'trigger', amount: 1, decay: 0.5 });
    const frame = (value: number, dt: number) => {
      beat.write(value);
      params.update(dt);
      return Math.round(params.get('growth') * 100) / 100;
    };

    assert({
      given: 'a rising edge, a held high input, then time passing',
      should: 'fire once and decay back to the base',
      actual: [frame(1, 0), frame(1, 0.25), frame(1, 0.25), frame(0, 0.1), frame(1, 0)],
      expected: [1, 0.5, 0, 0, 1],
    });
  });

  test('removal', () => {
    const params = createGrowth();
    const remove = params.modulate('growth', { read: () => 1, mode: 'replace', amount: 1 });
    params.update(0);
    const modulated = params.get('growth');
    remove();
    params.update(0);

    assert({
      given: 'a modulator that is removed',
      should: 'stop affecting the parameter',
      actual: [modulated, params.get('growth')],
      expected: [1, 0.5],
    });
  });
});
