// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { CURVE_SAMPLES, sampleCurve } from './curve.js';
import { fitPathFromStroke } from './path.js';
import type { Point } from './path.js';

const circle = (n: number, r = 0.5): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: Math.cos((i / n) * Math.PI * 2) * r, y: 1.3, z: Math.sin((i / n) * Math.PI * 2) * r }));

const row = (data: Float32Array, rowIndex: number, i: number) => {
  const o = (rowIndex * CURVE_SAMPLES + i) * 4;
  return [data[o]!, data[o + 1]!, data[o + 2]!];
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('sampleCurve()', () => {
  test('even arc-length spacing', () => {
    const line = fitPathFromStroke([{ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]);
    const curve = sampleCurve(line, false)!;
    const steps = Array.from({ length: 20 }, (_, i) => dist(row(curve.data, 0, i * 12), row(curve.data, 0, i * 12 + 1)));
    const spread = Math.max(...steps) - Math.min(...steps);

    assert({
      given: 'an open path with unevenly spaced anchors',
      should: 'space samples evenly by arc length',
      actual: spread < 1e-3,
      expected: true,
    });
  });

  test('closed seam', () => {
    const path = fitPathFromStroke(circle(12), { closed: true });
    const curve = sampleCurve(path, true)!;
    const last = CURVE_SAMPLES - 1;
    const step = curve.length / CURVE_SAMPLES;

    assert({
      given: 'a closed loop',
      should: 'join the last sample to the first at sample spacing',
      actual: Math.abs(dist(row(curve.data, 0, last), row(curve.data, 0, 0)) - step) < step * 0.05,
      expected: true,
    });

    assert({
      given: 'the frame carried all the way around a closed loop',
      should: 'meet the starting normal at the seam without a twist jump',
      actual: dist(row(curve.data, 2, last), row(curve.data, 2, 0)) < 0.1,
      expected: true,
    });
  });

  test('degenerate', () => {
    assert({
      given: 'fewer than two anchors',
      should: 'return null',
      actual: sampleCurve([], false),
      expected: null,
    });
  });
});
