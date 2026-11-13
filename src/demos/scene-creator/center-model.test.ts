// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { addCenter, centerTransformAtScale, copyVisualSettings, restoreCenter, type CenterObjectState } from './center-model.js';

const definitions = { color: { default: 0.4, min: 0, max: 1 }, speed: { default: 1, min: 0, max: 2 } };
const keys = ['color', 'speed'];
const settings = () => copyVisualSettings(keys, definitions, { color: 0.8, speed: 3, beatHit: 1 });

describe('Scene Creator Center Object', () => {
  test('copies only visual settings once and clamps saved values', () => {
    const source = { color: 0.8, speed: 3, beatHit: 1 };
    const copied = copyVisualSettings(keys, definitions, source);
    source.color = 0.2;
    assert({ given: 'standalone demo settings at creation', should: 'copy allowed values without a live link',
      actual: copied, expected: { color: 0.8, speed: 2 } });
  });

  test('choosing another type replaces the object and visibility is separate', () => {
    const first = addCenter('chrome', settings());
    const outgoing = { position: [0.4, 1.7, -0.8] as [number, number, number],
      quaternion: [0, 0.38, 0, 0.92] as [number, number, number, number], scale: 1.75 };
    const replaced = addCenter('cubes', { color: 0 }, outgoing);
    const hidden = { ...first, visible: false };
    const shown = { ...hidden, visible: true };
    outgoing.position[0] = 9;
    assert({ given: 'choosing a different Center Object', should: 'install that type at the outgoing pose without sharing transform arrays',
      actual: [replaced.type, replaced.transform], expected: ['cubes', { position: [0.4, 1.7, -0.8], quaternion: [0, 0.38, 0, 0.92], scale: 1.75 }] });
    assert({ given: 'visibility actions', should: 'preserve settings and transform', actual: [hidden.visible, shown.visible, shown.settings, shown.transform],
      expected: [false, true, first.settings, first.transform] });
    assert({ given: 'Remove', should: 'leave no Center Object', actual: null, expected: null });
  });

  test('replacement preserves the physical scale across different asset base scales', () => {
    const transform = centerTransformAtScale([0.4, 1.7, -0.8], [0, 0.38, 0, 0.92], 0.486, 0.24);
    assert({ given: 'an object at 0.486 metres replaced by one whose base scale is 0.24',
      should: 'save a multiplier that places the new object at the same physical scale and pose',
      actual: [transform.position, transform.quaternion, Math.round(transform.scale * 0.24 * 1000) / 1000],
      expected: [[0.4, 1.7, -0.8], [0, 0.38, 0, 0.92], 0.486] });
  });

  test('restores persisted type, settings, visibility and transform', () => {
    const saved = { type: 'chrome', settings: { color: 0.7, speed: 1.5, beatHit: 1 }, visible: false,
      transform: { position: [1, 2, 3], quaternion: [0, 0, 0, 1], scale: 1.4 } };
    const restored = restoreCenter(saved, () => definitions, () => keys);
    assert({ given: 'Scene Creator saved data', should: 'restore an isolated valid Center Object', actual: restored,
      expected: { type: 'chrome', settings: { color: 0.7, speed: 1.5 }, visible: false,
        transform: { position: [1, 2, 3], quaternion: [0, 0, 0, 1], scale: 1.4 } } satisfies CenterObjectState });
    assert({ given: 'an invalid transform', should: 'drop the object',
      actual: restoreCenter({ ...saved, transform: { ...saved.transform, scale: -1 } }, () => definitions, () => keys), expected: null });
  });

  test('drops saved objects whose type is not installed', () => {
    assert({ given: 'a saved Center Object from a branch with more plug-ins', should: 'restore nothing instead of failing',
      actual: restoreCenter({ type: 'not-installed', settings: {}, visible: true, transform: { position: [0, 1, -1], quaternion: [0, 0, 0, 1], scale: 1 } },
        () => undefined, () => []), expected: null });
  });
});
