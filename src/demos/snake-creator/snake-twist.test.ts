// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createSnakeRenderer } from './snake-renderer.js';
import { DEFAULT_LOOK } from './snake-look.js';

describe('snake twist for every body', () => {
  test('round tubes and spheres keep the requested frame twist', () => {
    const renderer = createSnakeRenderer();
    const actual = (['tube', 'spheres'] as const).map((body) => {
      renderer.apply({ ...DEFAULT_LOOK, body, profile: 0, twist: 1.25 }, { head: 0.5, tail: 0.1 });
      return renderer.uniforms.uSnakeTwist.value;
    });
    renderer.dispose();
    assert({ given: 'a round tube and spheres with a fractional twist', should: 'send that twist to both shaders',
      actual, expected: [1.25, 1.25] });
  });
});
