import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { summonPose, yawToward } from './panel-placement.js';

const round = (values: readonly number[]) => values.map((v) => Math.round(v * 1000) / 1000);

describe('yawToward()', () => {
  test('facing', () => {
    assert({
      given: 'a panel straight in front of the viewer (-Z)',
      should: 'need no yaw to face the viewer (panels face +Z)',
      actual: Math.round(yawToward([0, 0, -1], [0, 0, 0]) * 1000) / 1000,
      expected: 0,
    });

    assert({
      given: 'a panel to the viewer’s left',
      should: 'turn a quarter towards +X',
      actual: Math.round(yawToward([-1, 0, 0], [0, 0, 0]) * 1000) / 1000,
      expected: Math.round((Math.PI / 2) * 1000) / 1000,
    });
  });
});

describe('summonPose()', () => {
  test('in front of the head', () => {
    const pose = summonPose({ position: [0, 1.6, 0], forward: [0, 0, -1] }, { distance: 0.6, drop: 0.2 });

    assert({
      given: 'a viewer looking down -Z',
      should: 'place the panel at the comfortable distance, slightly below eye height, facing the viewer',
      actual: { position: round(pose.position), yaw: round([pose.yaw]) },
      expected: { position: [0, 1.4, -0.6], yaw: [0] },
    });
  });

  test('looking down', () => {
    const pose = summonPose({ position: [0, 1.6, 0], forward: [0, -0.9, -0.1] }, { distance: 0.6, drop: 0.2 });

    assert({
      given: 'a viewer looking steeply at the floor',
      should: 'use only the horizontal heading, keeping the panel at a readable height',
      actual: round(pose.position),
      expected: [0, 1.4, -0.6],
    });
  });

  test('looking straight down', () => {
    const pose = summonPose({ position: [1, 1.6, 1], forward: [0, -1, 0] }, { distance: 0.5, drop: 0.2 });

    assert({
      given: 'no horizontal heading at all',
      should: 'fall back to -Z instead of producing NaN',
      actual: round(pose.position),
      expected: [1, 1.4, 0.5],
    });
  });
});
