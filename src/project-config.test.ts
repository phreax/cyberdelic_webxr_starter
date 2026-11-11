import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import config from '../iwsdk.config.json';

describe('iwsdk.config.json', () => {
  test('XR input baseline', () => {
    assert({
      given: 'the project config',
      should: 'enable hand tracking (PRD §6.2)',
      actual: config.world.xr.features.handTracking,
      expected: true,
    });

    assert({
      given: 'the project config',
      should: 'enable grabbing for the reference sculpture (PRD §12.2)',
      actual: config.world.features.grabbing,
      expected: true,
    });
  });
});
