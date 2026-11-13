import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { withLightEstimation } from './light-estimation-opt-in.js';

describe('optional light estimation feature', () => {
  test('preserves session requirements and adds the feature once', () => {
    const init = withLightEstimation({ requiredFeatures: ['depth-sensing'], optionalFeatures: ['layers', 'light-estimation'] });
    assert({
      given: 'an IWSDK session request',
      should: 'retain requirements and request light estimation only once',
      actual: init,
      expected: { requiredFeatures: ['depth-sensing'], optionalFeatures: ['layers', 'light-estimation'] },
    });
  });
});
