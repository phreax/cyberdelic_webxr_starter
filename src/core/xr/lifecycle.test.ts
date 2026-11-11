import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { clampDelta, createDisposables, createLifecycle } from './lifecycle.js';

const createRecorder = () => {
  const calls: string[] = [];
  const experience = {
    init: (ctx: { name: string }) => void calls.push(`init:${ctx.name}`),
    update: (dt: number) => void calls.push(`update:${dt}`),
    dispose: () => void calls.push('dispose'),
  };
  return { calls, experience };
};

describe('createLifecycle()', () => {
  test('ordering', () => {
    const { calls, experience } = createRecorder();
    const lifecycle = createLifecycle(experience, { name: 'ctx' });

    lifecycle.tick(0.016);
    lifecycle.start();
    lifecycle.start();
    lifecycle.tick(0.016);
    lifecycle.stop();
    lifecycle.stop();
    lifecycle.tick(0.016);

    assert({
      given: 'ticks before start, repeated start/stop and ticks after stop',
      should: 'init once with the context, update only while running, dispose once',
      actual: calls,
      expected: ['init:ctx', 'update:0.016', 'dispose'],
    });
  });

  test('stop before start', () => {
    const { calls, experience } = createRecorder();
    const lifecycle = createLifecycle(experience, { name: 'ctx' });
    lifecycle.stop();

    assert({
      given: 'an experience that never started',
      should: 'not call dispose',
      actual: { calls, state: lifecycle.state },
      expected: { calls: [], state: 'disposed' },
    });
  });

  test('optional hooks', () => {
    const lifecycle = createLifecycle({}, {});
    lifecycle.start();
    lifecycle.tick(0.1);
    lifecycle.stop();

    assert({
      given: 'an experience without hooks',
      should: 'run through the whole lifecycle',
      actual: lifecycle.state,
      expected: 'disposed',
    });
  });
});

describe('clampDelta()', () => {
  test('frame delta guard', () => {
    assert({
      given: 'a long stall (tab in background)',
      should: 'cap the delta so animations do not jump',
      actual: clampDelta(5),
      expected: 0.1,
    });

    assert({
      given: 'a negative or non-finite delta',
      should: 'return 0',
      actual: [clampDelta(-1), clampDelta(Number.NaN)],
      expected: [0, 0],
    });
  });
});

describe('createDisposables()', () => {
  test('release order', () => {
    const calls: string[] = [];
    const disposables = createDisposables();
    disposables.add(() => void calls.push('listener'));
    disposables.add({ dispose: () => void calls.push('geometry') });
    disposables.disposeAll();
    disposables.disposeAll();

    assert({
      given: 'registered functions and disposable objects',
      should: 'release each once, in reverse registration order',
      actual: calls,
      expected: ['geometry', 'listener'],
    });
  });
});
