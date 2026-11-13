import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import scene from '../../../public/scenes/garden.iwsdk.scene.json';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panelIds = new Set([...read('../../../public/ui/garden-panel.uikitml').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

describe('garden scene + panel contract', () => {
  test('scene schema', () => {
    const result = validateSceneDocument(scene);
    assert({
      given: 'the garden scene',
      should: 'pass IWSDK scene validation',
      actual: result.valid ? [] : JSON.stringify(result),
      expected: [],
    });
  });

  test('panel ids', () => {
    const needed = [
      'panel', 'btn-hide',
      'audio-dot', 'audio-status', 'btn-mic', 'btn-capture', 'btn-demo', 'btn-stop',
      ...['garden', 'audio'].flatMap((n) => [`tab-${n}`, `page-${n}`]),
      ...['density', 'turbulence', 'speed', 'stir', 'memory', 'size', 'reactivity'].flatMap((id) => [id, `${id}-fill`, `${id}-value`]),
      ...['ember', 'cyberdelic', 'ethereal-garden', 'rainbow'].map((m) => `mood-${m}`),
    ];
    assert({
      given: 'the ids the garden experience binds',
      should: 'all exist in garden-panel.uikitml',
      actual: needed.filter((id) => !panelIds.has(id)),
      expected: [],
    });
  });

  test('zones', () => {
    assert({
      given: 'the garden scene',
      should: 'contain the field and one zone per mood',
      actual: scene.nodes.map((n) => n.id).filter((id) => id === 'particle-garden' || id.startsWith('zone-')),
      expected: ['particle-garden', 'zone-ember', 'zone-cyberdelic', 'zone-ethereal-garden', 'zone-rainbow'],
    });
  });
});
