import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import scene from '../../../public/scenes/snake.iwsdk.scene.json';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panelIds = new Set([...read('../../../public/ui/snake-panel.uikitml').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const literalIds = [...read('./snake-experience.ts').matchAll(/(?:requireElement|bindButton|bindSlider|bindToggle)\(panel, [`']([^`'$]+)[`']/g)].map((m) => m[1]!);

describe('snake scene + panel contract', () => {
  test('scene schema', () => {
    const result = validateSceneDocument(scene);
    assert({
      given: 'the snake scene',
      should: 'pass IWSDK scene validation',
      actual: result.valid ? [] : JSON.stringify(result),
      expected: [],
    });
  });

  test('panel ids', () => {
    const derived = [
      ...['draw', 'shape', 'look', 'motion', 'session'].flatMap((n) => [`tab-${n}`, `page-${n}`]),
      ...['draw', 'edit', 'view'].map((n) => `tool-${n}`),
      ...['round', 'square', 'hex'].map((n) => `profile-${n}`),
      ...['solid', 'rings', 'hilbert'].map((n) => `pattern-${n}`),
      ...['cyberdelic', 'ocean', 'ember', 'aurora'].map((n) => `palette-${n}`),
      ...Array.from({ length: 5 }, (_, i) => [`fg-swatch-${i}`, `bg-swatch-${i}`]).flat(),
      'fg-preview', 'fg-hue', 'fg-hue-fill',
      ...['thickness', 'length', 'headTaper', 'tailTaper', 'headShape', 'twist', 'scale', 'width', 'metallic', 'roughness', 'speed'].flatMap((id) => [id, `${id}-fill`, `${id}-value`]),
      ...['closed', 'reverse', 'hilbertAnimate', 'gradient'].flatMap((id) => [id, `${id}-thumb`]),
      'btn-vr', 'btn-mr', 'btn-exit', 'mode-dot', 'status', 'fps-dot', 'fps',
    ];
    assert({
      given: 'the ids the snake experience binds',
      should: 'all exist in snake-panel.uikitml',
      actual: [...literalIds, ...derived].filter((id) => !panelIds.has(id)),
      expected: [],
    });
  });
});
