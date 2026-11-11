import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panelIds = new Set([...source('../../../public/ui/control-panel.uikitml').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/** Literal element ids the experience and the panel menu look up. */
const usedIds = () => {
  const code = source('./reactive-sculpture-experience.ts');
  const literal = [...code.matchAll(/(?:requireElement|bindButton|bindSlider|bindKnob|bindToggle)\(panel, '([^']+)'/g)].map((m) => m[1]!);
  const derived = [
    ...['growth', 'complexity', 'flow', 'glow', 'alpha', 'reactivity'].flatMap((id) => [id, `${id}-fill`, `${id}-value`]),
    ...['twist', 'hue'].flatMap((id) => [id, `${id}-indicator`, `${id}-value`]),
    ...['spin', 'haptics'].flatMap((id) => [id, `${id}-thumb`]),
    ...['shape', 'audio', 'presets', 'session'].flatMap((name) => [`tab-${name}`, `page-${name}`]),
    ...['coral', 'nebula', 'ember', 'void'].map((name) => `preset-${name}`),
    ...['volume', 'bass', 'mid', 'high'].map((signal) => `meter-${signal}`),
    ...Array.from({ length: 16 }, (_, i) => `spec-${i}`),
    'audio-dot', 'audio-status', 'mode-dot', 'status', 'fps-dot', 'fps',
  ];
  return [...new Set([...literal, ...derived])];
};

describe('control-panel.uikitml contract', () => {
  test('element ids', () => {
    assert({
      given: 'the ids the Reactive Sculpture experience looks up',
      should: 'all exist in the panel markup',
      actual: usedIds().filter((id) => !panelIds.has(id)),
      expected: [],
    });
  });
});
