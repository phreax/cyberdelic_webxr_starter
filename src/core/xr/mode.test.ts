import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { resolveXRMode } from './mode.js';

describe('resolveXRMode()', () => {
  test('mixed reality', () => {
    assert({
      given: 'mixed-reality requested on a passthrough device',
      should: 'use an immersive-ar session',
      actual: resolveXRMode('mixed-reality', { vr: true, ar: true }),
      expected: { mode: 'mixed-reality', session: 'immersive-ar', background: 'passthrough' },
    });

    const fallback = resolveXRMode('mixed-reality', { vr: true, ar: false });
    assert({
      given: 'mixed-reality requested on a device without passthrough',
      should: 'fall back to VR and explain why',
      actual: { mode: fallback.mode, hasReason: 'fallbackReason' in fallback && typeof fallback.fallbackReason === 'string' },
      expected: { mode: 'vr', hasReason: true },
    });
  });

  test('vr', () => {
    assert({
      given: 'VR requested on a VR-capable device',
      should: 'use an opaque immersive-vr session',
      actual: resolveXRMode('vr', { vr: true, ar: true }),
      expected: { mode: 'vr', session: 'immersive-vr', background: 'opaque' },
    });
  });

  test('no WebXR', () => {
    assert({
      given: 'no immersive support at all',
      should: 'report that XR is unavailable',
      actual: resolveXRMode('vr', { vr: false, ar: false }).mode,
      expected: null,
    });
  });
});
