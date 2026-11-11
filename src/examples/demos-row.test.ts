import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';

const EXAMPLE_IDS = ['sculpture', 'garden', 'snake', 'playground'];
const PANELS = ['control-panel', 'garden-panel', 'snake-list', 'playground-panel'];

describe('Demos row', () => {
  test('every panel offers every example', () => {
    const missing = PANELS.flatMap((panel) => {
      const markup = readFileSync(new URL(`../../public/ui/${panel}.uikitml`, import.meta.url), 'utf8');
      return EXAMPLE_IDS.filter((id) => !markup.includes(`id="example-${id}"`)).map((id) => `${panel}: example-${id}`);
    });
    const registry = readFileSync(new URL('./registry.ts', import.meta.url), 'utf8');

    assert({
      given: 'the example panels and the example registry',
      should: 'show a switch button for every registered example in every panel',
      actual: { missing, registered: EXAMPLE_IDS.filter((id) => !new RegExp(`\\b${id}: \\{`).test(registry)) },
      expected: { missing: [], registered: [] },
    });
  });
});
