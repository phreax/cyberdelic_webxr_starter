import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { createInteractionSounds, INTERACTION_SOUNDS } from './interaction-sounds.js';

describe('createInteractionSounds()', () => {
  test('lazy audio', () => {
    let created = 0;
    const sounds = createInteractionSounds({ createContext: () => (created += 1, undefined) });
    const before = created;
    sounds.play('click');

    assert({
      given: 'sounds that were never played, then a play call',
      should: 'not create an audio context until the first play (user gesture)',
      actual: [before, created],
      expected: [0, 1],
    });
  });

  test('catalogue', () => {
    assert({
      given: 'the sound catalogue',
      should: 'cover click, select, grab and release',
      actual: Object.keys(INTERACTION_SOUNDS).sort(),
      expected: ['click', 'grab', 'release', 'select'],
    });
  });
});
