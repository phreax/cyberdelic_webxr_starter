import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import scene from '../../../public/scenes/snake.iwsdk.scene.json';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ids = (file: string) => new Set([...read(`../../../public/ui/${file}.uikitml`).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const code = read('./snake-experience.ts');
const literal = (panel: string) =>
  [...code.matchAll(new RegExp(`(?:requireElement|bindButton|bindSlider|bindToggle)\\(${panel}, ['\`]([^'\`$]+)['\`]`, 'g'))].map((m) => m[1]!);

const PARAMS = ['thickness', 'length', 'headTaper', 'tailTaper', 'headShape', 'twist', 'spread', 'scale', 'width',
  'backgroundOffset', 'backgroundBrightness', 'iridescence', 'metallic', 'roughness', 'speed'];

describe('snake scene + windows contract', () => {
  test('scene schema', () => {
    const result = validateSceneDocument(scene);
    assert({
      given: 'the snake scene',
      should: 'pass IWSDK scene validation and place the three windows',
      actual: [result.valid ? [] : JSON.stringify(result), scene.nodes.map((n) => n.id).filter((id) => id.startsWith('snake-'))],
      expected: [[], ['snake-list', 'snake-params', 'snake-edit']],
    });
  });

  test('list window', () => {
    const panel = ids('snake-list');
    const needed = [...literal('listPanel'), ...Array.from({ length: 8 }, (_, i) => [`snake-row-${i}`, `snake-row-${i}-name`, `snake-row-${i}-info`]).flat(),
      'btn-vr', 'btn-mr', 'btn-exit', 'mode-dot', 'status', 'fps-dot', 'fps', 'list-empty'];
    assert({ given: 'the list window ids the experience uses', should: 'all exist', actual: needed.filter((id) => !panel.has(id)), expected: [] });
  });

  test('edit window', () => {
    const panel = ids('snake-edit');
    const needed = [...literal('editPanel'), 'tool-draw', 'tool-move', 'closed', 'closed-thumb'];
    assert({ given: 'the edit window ids the experience uses', should: 'all exist', actual: needed.filter((id) => !panel.has(id)), expected: [] });
  });

  test('settings window', () => {
    const panel = ids('snake-params');
    const needed = [
      ...literal('paramsPanel'),
      ...['shape', 'pattern', 'material', 'motion'].flatMap((n) => [`tab-${n}`, `page-${n}`]),
      ...PARAMS.flatMap((id) => [id, `${id}-fill`, `${id}-value`]),
      ...['transparent', 'reverse'].flatMap((id) => [id, `${id}-thumb`]),
      'profile-round', 'profile-square', 'pattern-solid', 'pattern-rings', 'pattern-hilbert',
      'palette-ethereal-garden', 'palette-cyberdelic', 'palette-ocean', 'palette-amber', 'bg-settings',
    ];
    assert({ given: 'the settings window ids the experience uses', should: 'all exist', actual: needed.filter((id) => !panel.has(id)), expected: [] });
  });

  test('removed options', () => {
    const panel = ids('snake-params');
    assert({
      given: 'the simplified settings window',
      should: 'no longer offer hex profile, Hilbert animation, colour pickers or gloss',
      actual: ['profile-hex', 'hilbertAnimate', 'fg-preview', 'bg-swatch-0', 'gloss'].filter((id) => panel.has(id)),
      expected: [],
    });
  });
});
