import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createParameterStore } from '../parameters/store.js';
import { createSettingsStorage, persistParams } from './settings-storage.js';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  };
};

describe('createSettingsStorage()', () => {
  test('round trip and namespacing', () => {
    const backing = memoryStorage();
    const garden = createSettingsStorage('garden', backing);
    const snake = createSettingsStorage('snake', backing);
    garden.save('mood', 'Rainbow');
    snake.save('mood', 'other');

    assert({
      given: 'two examples saving the same key',
      should: 'keep their values apart',
      actual: [garden.load('mood'), snake.load('mood')],
      expected: ['Rainbow', 'other'],
    });
  });

  test('clear', () => {
    const backing = memoryStorage();
    const garden = createSettingsStorage('garden', backing);
    const snake = createSettingsStorage('snake', backing);
    garden.save('a', 1);
    garden.save('b', 2);
    snake.save('a', 3);
    garden.clear();

    assert({
      given: 'a reset of one example',
      should: 'remove only that example’s settings',
      actual: [garden.load('a'), garden.load('b'), snake.load('a')],
      expected: [undefined, undefined, 3],
    });
  });

  test('robustness', () => {
    const backing = memoryStorage();
    backing.setItem('cyberdelic:v1:garden:broken', '{not json');
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {}, key: () => null, length: 0 };

    assert({
      given: 'corrupt JSON, a storage that throws, and no storage at all',
      should: 'fall back to undefined without throwing',
      actual: [
        createSettingsStorage('garden', backing).load('broken'),
        createSettingsStorage('garden', throwing).load('x'),
        (createSettingsStorage('garden', throwing).save('x', 1), 'saved'),
        createSettingsStorage('garden', undefined).load('x'),
      ],
      expected: [undefined, undefined, 'saved', undefined],
    });
  });
});

describe('persistParams()', () => {
  const setup = () => {
    const backing = memoryStorage();
    const storage = createSettingsStorage('sculpture', backing);
    const params = createParameterStore();
    params.define('growth', { default: 0.5 });
    params.define('hue', { default: 0 });
    const pending: Array<() => void> = [];
    const schedule = (fn: () => void) => void pending.push(fn);
    return { backing, storage, params, pending, schedule };
  };

  test('restore', () => {
    const { storage, params, schedule } = setup();
    storage.save('params', { growth: 0.8, hue: 'nope', removed: 1 });
    persistParams(params, storage, { schedule });
    params.update(0);

    assert({
      given: 'saved values including a wrong type and a removed parameter',
      should: 'restore valid known values only',
      actual: [params.get('growth'), params.get('hue')],
      expected: [0.8, 0],
    });
  });

  test('save after changes', () => {
    const { storage, params, pending, schedule } = setup();
    persistParams(params, storage, { schedule });
    params.set('growth', 0.3, 'ui');
    params.set('hue', 0.6, 'ui');
    const before = storage.load('params');
    pending.forEach((fn) => fn());

    assert({
      given: 'two changes before the debounced save runs',
      should: 'save once, with all current values',
      actual: [before, pending.length, storage.load('params')],
      expected: [undefined, 1, { growth: 0.3, hue: 0.6 }],
    });
  });
});
