// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { panelIds } from '../../core/demos/panel-ids.js';
import { centerSettingKeys } from './center-object.js';
import { CENTER_OBJECTS } from './center-registry.js';

const ids = panelIds('snake-params');

/** The UIKit ids the Scene Creator binds for one Center Object setting. */
const settingIds = (id: string, key: string, type?: string) =>
  key === 'quality' ? [`setting-${id}-${key}`, ...['low', 'medium', 'high'].map((level) => `center-${id}-${key}-${level}`)]
    : type === 'boolean' ? [`setting-${id}-${key}`, `center-${id}-${key}`, `center-${id}-${key}-thumb`]
      : [`setting-${id}-${key}`, `center-${id}-${key}`, `center-${id}-${key}-fill`, `center-${id}-${key}-value`];

describe('Scene Creator Center Object controls', () => {
  test('every registered Center Object has a picker button and all its settings controls', () => {
    const missing = CENTER_OBJECTS.flatMap((definition) => [`choose-${definition.id}`,
      ...centerSettingKeys(definition).flatMap((key) => settingIds(definition.id, key, definition.params[key]!.type))]).filter((id) => !ids.has(id));
    assert({ given: 'every center.ts plug-in', should: 'find its controls in snake-params.uikitml', actual: missing, expected: [] });
  });

  test('quality uses three named choices, never a slider', () => {
    const types = CENTER_OBJECTS.filter((definition) => centerSettingKeys(definition).includes('quality'));
    assert({ given: 'quality settings shared with standalone demos', should: 'offer Low, Medium and High buttons only',
      actual: types.filter((definition) => ids.has(`center-${definition.id}-quality`)).map((definition) => definition.id), expected: [] });
  });

  test('manipulation mode is a session toggle, not a saved visual setting', () => {
    assert({ given: 'manipulable Center Objects', should: 'share one Manipulate toggle and never save manipulateMode',
      actual: [ids.has('center-manipulate'), ids.has('center-manipulate-thumb'),
        CENTER_OBJECTS.some((definition) => centerSettingKeys(definition).includes('manipulateMode'))], expected: [true, true, false] });
  });

  test('reflection warmth belongs to the scene instead of a Center Object', () => {
    assert({ given: 'all Center Object setting lists', should: 'omit the duplicate reflection warmth control',
      actual: CENTER_OBJECTS.some((definition) => centerSettingKeys(definition).includes('reflectionWarmth')), expected: false });
  });

  test('ids are unique', () => {
    const list = CENTER_OBJECTS.map((definition) => definition.id);
    assert({ given: 'registered Center Objects', should: 'have unique ids', actual: list.length, expected: new Set(list).size });
  });
});
