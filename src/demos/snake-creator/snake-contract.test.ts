// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import scene from '../../../public/scenes/snake.iwsdk.scene.json';
import { BUILT_IN_BODIES, SNAKE_BODIES } from './body-registry.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ids = (file: string) => new Set([...read(`../../../public/ui/${file}.uikitml`).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const code = read('./snake-experience.ts');
const literal = (panel: string) =>
  [...code.matchAll(new RegExp(`(?:requireElement|bindButton|bindSlider|bindToggle)\\(${panel}, ['\`]([^'\`$]+)['\`]`, 'g'))].map((m) => m[1]!);

const PARAMS = ['thickness', 'length', 'headTaper', 'tailTaper', 'headShape', 'sphereDensity', 'sphereSize', 'twist', 'spread', 'gradientOffset', 'scale', 'width', 'hilbertSharpness',
  'backgroundOffset', 'backgroundBrightness', 'iridescence', 'mirrorDistance', 'metallic', 'environmentAmount', 'roughness', 'speed'];

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
      'btn-open-snake-settings', 'list-empty',
      'environmentWarmth', 'environmentWarmth-fill', 'environmentWarmth-value'];
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
      ...['transparent', 'reverse', 'mirror'].flatMap((id) => [id, `${id}-thumb`]),
      ...[...BUILT_IN_BODIES, ...SNAKE_BODIES].map((body) => `body-${body.label.toLowerCase().replace(/\s+/g, '-')}`),
      ...SNAKE_BODIES.flatMap((body) => [...(body.sections ?? []), ...Object.keys(body.params ?? {}).flatMap((id) => [id, `${id}-fill`, `${id}-value`])]),
      // A glowing-core body brings the core glow controls.
      ...(SNAKE_BODIES.some((body) => body.core?.glow) ? ['glow', 'glow-fill', 'glow-value', 'glow-picker-preview', 'glow-picker-hue', 'glow-picker-saturation', 'glow-picker-value'] : []),
      'sphere-settings', 'mirror-settings', 'profile-round', 'profile-square', 'pattern-solid', 'pattern-rings', 'pattern-hilbert',
      'palette-ethereal-garden', 'palette-cyberdelic', 'palette-ocean', 'palette-ember', 'palette-white', 'palette-scifi-machine', 'bg-settings',
    ];
    assert({ given: 'the settings window ids the experience uses', should: 'all exist', actual: needed.filter((id) => !panel.has(id)), expected: [] });
  });

  test('removed options', () => {
    const panel = ids('snake-params');
    assert({
      given: 'the simplified settings window',
      should: 'no longer offer hex profile, Hilbert animation or gloss',
      actual: ['profile-hex', 'hilbertAnimate', 'fg-preview', 'bg-swatch-0', 'gloss'].filter((id) => panel.has(id)),
      expected: [],
    });
  });

  test('Hilbert sharpness keeps derivative antialiasing', () => {
    const shader = read('./snake-fragment-common.glsl');
    const look = read('./snake-look.ts');
    assert({ given: 'Hilbert edge control', should: 'default to the existing crisp edge and retain fwidth smoothing',
      actual: [look.includes('hilbertSharpness: 1'), shader.includes('fwidth(cell.x) + fwidth(cell.y)'), shader.includes('uSnakeHilbertSharpness')],
      expected: [true, true, true] });
    assert({ given: 'the pattern panel', should: 'show a conditional sharpness slider',
      actual: ['hilbert-settings', 'hilbertSharpness', 'hilbertSharpness-fill', 'hilbertSharpness-value'].every((id) => ids('snake-params').has(id)),
      expected: true });
  });
});
