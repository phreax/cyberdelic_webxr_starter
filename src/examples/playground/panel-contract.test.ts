import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ids = (uikitml: string) => new Set([...read(uikitml).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const literalIds = (code: string, variable: string) =>
  [...read(code).matchAll(new RegExp(`(?:requireElement|bindButton|bindSlider|bindKnob|bindToggle|bindDropdown|bindValueDisplay)\\(${variable}, '([^']+)'`, 'g'))].map((m) => m[1]!);

describe('playground UIKitML contract', () => {
  test('panel ids', () => {
    const panel = ids('../../../public/ui/playground-panel.uikitml');
    const derived = [
      ...['controls', 'triggers', 'osc'].flatMap((n) => [`tab-${n}`, `page-${n}`]),
      'accent-label', 'accent-list', 'accent-option-0', 'accent-option-1', 'accent-option-2',
      'cube-color-preview', 'cube-color-hue', 'cube-color-hue-fill', ...Array.from({ length: 5 }, (_, i) => `cube-color-swatch-${i}`),
      'gem-size-fill', ...Array.from({ length: 5 }, (_, i) => `log-${i}`), ...Array.from({ length: 4 }, (_, i) => `osc-rate-${i}`),
      'osc-dot', 'osc-status', 'mode-dot', 'status', 'gaze-progress',
    ];
    assert({
      given: 'the ids the playground looks up in its panel',
      should: 'all exist in playground-panel.uikitml',
      actual: [...literalIds('./playground-experience.ts', 'panel'), ...derived].filter((id) => !panel.has(id)),
      expected: [],
    });
  });

  test('toolbar ids', () => {
    const toolbar = ids('../../../public/ui/toolbar.uikitml');
    assert({
      given: 'the toolbar buttons the playground binds',
      should: 'all exist in toolbar.uikitml',
      actual: literalIds('./playground-experience.ts', 'toolbar').filter((id) => !toolbar.has(id)),
      expected: [],
    });
  });
});
