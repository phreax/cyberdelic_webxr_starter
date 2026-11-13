import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { validateSceneDocument } from '@iwsdk/scene-composition';
import { DEMO_SLOTS } from '../components/ui/standard-sections.js';
import { panelIds } from '../core/demos/panel-ids.js';
import { DEFAULT_EXAMPLE, DEMOS } from './registry.js';

const publicFile = (path: string) => new URL(`../../public/${path}`, import.meta.url);
/** Scene file a demo loads, relative to public/. */
const sceneOf = (id: string) => (DEMOS.find((demo) => demo.id === id)!.config().level ?? '').replace(/^.*?scenes\//, 'scenes/');

describe('demo registry (every src/demos/*/demo.ts and src/lab/*/demo.ts)', () => {
  test('ids are unique and the default demo exists', () => {
    const ids = DEMOS.map((demo) => demo.id);
    assert({ given: 'the discovered demos', should: 'have unique ids including the default',
      actual: [ids.length === new Set(ids).size, ids.includes(DEFAULT_EXAMPLE)], expected: [true, true] });
  });

  test('every demo scene exists, validates and places the shared Demos picker', () => {
    const broken = DEMOS.filter(({ id }) => {
      const url = publicFile(sceneOf(id));
      if (!existsSync(url)) return true;
      const scene = JSON.parse(readFileSync(url, 'utf8'));
      return !validateSceneDocument(scene).valid || !JSON.stringify(scene).includes('"id":"demos-panel"');
    }).map(({ id }) => id);
    assert({ given: 'each demo scene file', should: 'exist, be valid and place the picker', actual: broken, expected: [] });
  });

  test('the picker has a slot per demo plus Session navigation', () => {
    const ids = panelIds('demos-panel');
    const needed = [...Array.from({ length: DEMO_SLOTS }, (_, i) => [`demo-slot-${i}`, `demo-slot-${i}-label`]).flat(),
      'btn-settings', 'btn-back-demos', 'btn-close-demos', 'console-demos', 'console-session'];
    assert({ given: 'the Demos panel', should: 'have every slot and Session control, and room for every demo',
      actual: [needed.filter((id) => !ids.has(id)), DEMOS.length <= DEMO_SLOTS], expected: [[], true] });
  });

  test('patterned vision settings live on the Session page', () => {
    const ids = panelIds('demos-panel');
    const needed = ['patterned-vision', 'patterned-room', 'patterned-hand-controls',
      ...['pattern-scale', 'pattern-room-scale', 'pattern-warp', 'pattern-position-x', 'pattern-position-y', 'pattern-alpha', 'pattern-room-alpha', 'pattern-chroma', 'pattern-finger-length']
        .flatMap((id) => [id, `${id}-fill`, `${id}-value`])];
    assert({ given: 'the shared Session page', should: 'offer the patterned hand and room controls', actual: needed.filter((id) => !ids.has(id)), expected: [] });
  });

  test('no demo panel duplicates the picker', () => {
    const files = (dir: string): string[] => readdirSync(publicFile(dir), { withFileTypes: true })
      .flatMap((entry) => entry.isDirectory() ? files(`${dir}/${entry.name}`) : entry.name.endsWith('.uikitml') ? [`${dir}/${entry.name}`] : []);
    const duplicated = files('ui').filter((file) => !file.endsWith('demos-panel.uikitml'))
      .filter((file) => /id="(console-demos|btn-demos|example-[a-z-]+)"/.test(readFileSync(publicFile(file), 'utf8')));
    assert({ given: 'every panel except the picker', should: 'not contain its own demo list', actual: duplicated, expected: [] });
  });
});
