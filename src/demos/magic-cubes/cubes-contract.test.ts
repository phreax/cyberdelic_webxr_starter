// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import { slugify } from '../../components/ui/controls-advanced.js';
import { panelIds as ids, SESSION_IDS as SESSION, sliderIds as sliders, toggleIds as toggles } from '../../core/demos/panel-ids.js';
import scene from '../../../public/scenes/cubes.iwsdk.scene.json';
import { CUBE_PALETTES } from './cubes-experience.js';

describe('Cubes contract', () => {
  test('scene', () => {
    assert({ given: 'the Cubes scene', should: 'validate', actual: validateSceneDocument(scene).valid, expected: true });
  });

  test('cubes panel', () => {
    const panel = ids('cubes-panel');
    const needed = [
      ...SESSION, ...sliders(['speed', 'colorOffset']), ...toggles(['kaleidoscope', 'glow']),
      'mode-cube', 'mode-rings', 'mode-both', 'colorMode-dual', 'colorMode-gradient', 'colorMode-alternate',
      ...CUBE_PALETTES.map((p) => `palette-${slugify(p)}`),
      ...['shape', 'color'].flatMap((n) => [`tab-${n}`, `page-${n}`]),
    ];
    assert({ given: 'the cubes panel ids the experience binds', should: 'all exist', actual: needed.filter((id) => !panel.has(id)), expected: [] });
  });});
