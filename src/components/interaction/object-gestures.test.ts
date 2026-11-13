import { Vector3 } from '@iwsdk/core';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { rayIntersectsGestureSphere } from './object-gestures.js';

describe('raymarch gesture targeting', () => {
  test('a target ray can select the object without registering its render proxy for pointer hits', () => {
    const origin = new Vector3(0, 0, 0);
    const direction = new Vector3(0, 0, -1);
    const center = new Vector3(0, 0, -2);
    const hit = rayIntersectsGestureSphere(origin, direction, center, 0.5);
    center.x = 0.6;
    const miss = rayIntersectsGestureSphere(origin, direction, center, 0.5);
    center.set(0, 0, 2);
    const behind = rayIntersectsGestureSphere(origin, direction, center, 0.5);
    assert({ given: 'a forward ray and nearby object positions', should: 'accept only a forward sphere hit', actual: [hit, miss, behind], expected: [true, false, false] });
  });
});
