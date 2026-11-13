// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { deleteAnchors, fitPathFromStroke, insertAnchor, isLoopStroke, simplifyStroke, strokeLength, type Point } from './path.js';

const noisyLine = (): Point[] =>
  Array.from({ length: 200 }, (_, i) => ({ x: i / 100, y: 1.2 + Math.sin(i * 7.3) * 0.002, z: -1 }));

describe('simplifyStroke()', () => {
  test('noisy stroke', () => {
    const simplified = simplifyStroke(noisyLine(), 0.01);
    assert({
      given: 'a long, slightly noisy straight stroke',
      should: 'keep only a few points, including both ends',
      actual: [simplified.length <= 4, simplified[0], simplified[simplified.length - 1]],
      expected: [true, noisyLine()[0], noisyLine()[199]],
    });
  });
});

describe('fitPathFromStroke()', () => {
  test('passes through points', () => {
    const points = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 0, z: 0 }];
    assert({
      given: 'stroke corners',
      should: 'create one anchor per point at that point',
      actual: fitPathFromStroke(points).map((a) => a.point),
      expected: points,
    });
  });
});

describe('insertAnchor() / deleteAnchors()', () => {
  const path = fitPathFromStroke([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }]);

  test('insert', () => {
    assert({
      given: 'a split in the middle of the first segment',
      should: 'add one anchor on the curve',
      actual: insertAnchor(path, 0, 0.5, false).length,
      expected: 4,
    });
  });

  test('closing segment', () => {
    assert({
      given: 'a closed path and the segment from the last anchor back to the first',
      should: 'insert there too',
      actual: insertAnchor(path, 2, 0.5, true).length,
      expected: 4,
    });
  });

  test('minimum', () => {
    assert({
      given: 'a delete that would leave fewer than two anchors',
      should: 'keep the path unchanged',
      actual: deleteAnchors(path, new Set([0, 1])).length,
      expected: 3,
    });
  });
});

describe('stroke helpers', () => {
  test('length and loop detection', () => {
    const loop = Array.from({ length: 40 }, (_, i) => ({ x: Math.cos((i / 39) * Math.PI * 2) * 0.3, y: 1, z: Math.sin((i / 39) * Math.PI * 2) * 0.3 }));
    assert({
      given: 'a stroke that ends where it began, and a straight one',
      should: 'detect only the first as a loop',
      actual: [isLoopStroke(loop), isLoopStroke(noisyLine()), Math.round(strokeLength(noisyLine()) * 10) / 10],
      expected: [true, false, 2],
    });
  });
});

import { refitEndHandles } from './path.js';

describe('refitEndHandles()', () => {
  test('closing smooths the seam', () => {
    const points = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }];
    const closed = refitEndHandles(fitPathFromStroke(points), true);
    const last = closed[3]!;
    const first = closed[0]!;
    // Smooth through the seam: last.outHandle and first.inHandle point along the closing segment.
    const outDir = { x: last.outHandle.x - last.point.x, y: last.outHandle.y - last.point.y };
    assert({
      given: 'an open square path closed into a loop',
      should: 'give the end anchors handles that continue through the closing segment',
      actual: [outDir.y < 0, first.inHandle.y < first.point.y || first.inHandle.x < first.point.x],
      expected: [true, true],
    });
  });
});

import { smoothStroke } from './path.js';
import { sampleCurve, CURVE_SAMPLES } from './curve.js';

describe('smoother curves', () => {
  test('uneven spacing does not overshoot', () => {
    // A long segment next to a very short one used to make the handles overshoot (kinks).
    const points = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1.02, y: 0.02, z: 0 }, { x: 1.04, y: 1, z: 0 }];
    const curve = sampleCurve(fitPathFromStroke(points), false)!;
    let maxX = -Infinity;
    for (let i = 0; i < CURVE_SAMPLES; i += 1) maxX = Math.max(maxX, curve.data[i * 4]!);
    assert({
      given: 'anchors with very uneven spacing',
      should: 'stay close to the points instead of looping past them',
      actual: maxX < 1.045, // points reach x = 1.04
      expected: true,
    });
  });

  test('stroke smoothing', () => {
    const zigzag = Array.from({ length: 40 }, (_, i) => ({ x: i * 0.01, y: i % 2 ? 0.004 : -0.004, z: 0 }));
    const smoothed = smoothStroke(zigzag, 2);
    const jitter = (ps: { y: number }[]) => Math.max(...ps.slice(2, -2).map((p) => Math.abs(p.y)));
    assert({
      given: 'a jittery hand-drawn stroke',
      should: 'reduce the jitter but keep both end points',
      actual: [jitter(smoothed) < jitter(zigzag) * 0.6, smoothed[0], smoothed[smoothed.length - 1]],
      expected: [true, zigzag[0], zigzag[zigzag.length - 1]],
    });
  });
});
