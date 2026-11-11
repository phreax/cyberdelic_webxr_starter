import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import scene from '../public/scenes/main.iwsdk.scene.json';

describe('public/scenes/main.iwsdk.scene.json', () => {
  test('schema', () => {
    const result = validateSceneDocument(scene);
    assert({
      given: 'the authored main scene',
      should: 'pass IWSDK scene validation (an invalid scene renders a blank screen)',
      actual: result.valid ? [] : JSON.stringify(result),
      expected: [],
    });
  });

  test('placeholder nodes', () => {
    assert({
      given: 'the authored main scene',
      should: 'place the orb and the control panel the experience looks up',
      actual: scene.nodes.map((node) => node.id).filter((id) => id === 'cyber-orb' || id === 'control-panel'),
      expected: ['cyber-orb', 'control-panel'],
    });
  });
});
