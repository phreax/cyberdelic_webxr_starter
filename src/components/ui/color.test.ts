import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { hexToHsv, hsvToHex } from './color.js';

describe('hexToHsv() / hsvToHex()', () => {
  test('known colours', () => {
    assert({
      given: 'pure red, the Cyberdelic primary and black',
      should: 'convert to HSV (h 0..1)',
      actual: [hexToHsv('#ff0000'), hexToHsv('#000000')],
      expected: [{ h: 0, s: 1, v: 1 }, { h: 0, s: 0, v: 0 }],
    });
  });

  test('round trip', () => {
    const colours = ['#00d9c7', '#ff9500', '#071514', '#f1f7f5', '#7f3fbf'];
    assert({
      given: 'theme colours',
      should: 'round-trip hex → HSV → hex exactly',
      actual: colours.map((hex) => hsvToHex(hexToHsv(hex))),
      expected: colours,
    });
  });
});
