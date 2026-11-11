import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { resolveExample } from './example-registry.js';

const registry = { sculpture: 'A', garden: 'B' };

describe('resolveExample()', () => {
  test('selection', () => {
    assert({
      given: 'a known ?example= id',
      should: 'select it',
      actual: resolveExample('?example=garden', registry, 'sculpture'),
      expected: { id: 'garden' },
    });

    assert({
      given: 'no example parameter',
      should: 'select the default',
      actual: resolveExample('', registry, 'sculpture'),
      expected: { id: 'sculpture' },
    });
  });

  test('unknown id', () => {
    const result = resolveExample('?example=nope', registry, 'sculpture');
    assert({
      given: 'an unknown example id',
      should: 'fall back to the default and explain why',
      actual: { id: result.id, explained: typeof result.fallbackReason === 'string' },
      expected: { id: 'sculpture', explained: true },
    });
  });
});
