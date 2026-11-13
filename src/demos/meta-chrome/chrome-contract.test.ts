// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import { slugify } from '../../components/ui/controls-advanced.js';
import { panelIds as ids, SESSION_IDS as SESSION, sliderIds as sliders, toggleIds as toggles } from '../../core/demos/panel-ids.js';
import scene from '../../../public/scenes/chrome.iwsdk.scene.json';
import { CHROME_GLOW_COLORS } from './meta-chrome-experience.js';

describe('Meta Chrome contract', () => {
  test('scene', () => {
    assert({ given: 'the Meta Chrome scene', should: 'validate', actual: validateSceneDocument(scene).valid, expected: true });
  });

  test('Meta Chrome panel', () => {
    const panel = ids('chrome-panel');
    const needed = [
      ...SESSION, ...sliders(['speed', 'glowAmount', 'exposure', 'reflectionWarmth', 'iridescent', 'sphereSize', 'sminFactor']),
      ...toggles(['manipulateMode', 'showSpheres']), 'manipulate-controls', 'interaction-hint',
      ...CHROME_GLOW_COLORS.map((name) => `glowColor-${slugify(name)}`),
      ...['shape', 'glow', 'light'].flatMap((n) => [`tab-${n}`, `page-${n}`]),
    ];
    assert({ given: 'the Meta Chrome panel ids the experience binds', should: 'all exist', actual: needed.filter((id) => !panel.has(id)), expected: [] });
  });});
