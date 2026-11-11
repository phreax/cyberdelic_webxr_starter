import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { controlStyle, cyberdelicTheme, defineTheme, withAlpha } from './cyberdelic.js';

describe('defineTheme()', () => {
  test('overrides', () => {
    const theme = defineTheme({ colors: { primary: '#ff00ff' }, panel: { radius: 24 } });

    assert({
      given: 'partial overrides',
      should: 'merge them over the defaults',
      actual: [theme.colors.primary, theme.colors.secondary, theme.panel.radius, theme.panel.opacity],
      expected: ['#ff00ff', cyberdelicTheme.colors.secondary, 24, cyberdelicTheme.panel.opacity],
    });

    assert({
      given: 'overrides were applied',
      should: 'leave the default theme untouched',
      actual: cyberdelicTheme.colors.primary,
      expected: '#00D9C7',
    });
  });
});

describe('controlStyle()', () => {
  const idle = { hovered: false, pressed: false, selected: false, disabled: false };
  const key = (s: ReturnType<typeof controlStyle>) => JSON.stringify(s);

  test('distinct states', () => {
    const styles = [
      controlStyle(cyberdelicTheme, idle),
      controlStyle(cyberdelicTheme, { ...idle, hovered: true }),
      controlStyle(cyberdelicTheme, { ...idle, pressed: true }),
      controlStyle(cyberdelicTheme, { ...idle, selected: true }),
    ].map(key);

    assert({
      given: 'idle, hovered, pressed and selected states',
      should: 'produce four distinct styles',
      actual: new Set(styles).size,
      expected: 4,
    });
  });

  test('disabled precedence', () => {
    assert({
      given: 'a disabled control that is also hovered and pressed',
      should: 'look exactly like a plain disabled control',
      actual: key(controlStyle(cyberdelicTheme, { hovered: true, pressed: true, selected: false, disabled: true })),
      expected: key(controlStyle(cyberdelicTheme, { ...idle, disabled: true })),
    });
  });
});

describe('withAlpha()', () => {
  test('hex with alpha', () => {
    assert({
      given: 'a #rrggbb colour and an opacity',
      should: 'return #rrggbbaa for UIKit',
      actual: [withAlpha('#00D9C7', 1), withAlpha('#00d9c7', 0.25), withAlpha('#152322', 0)],
      expected: ['#00d9c7ff', '#00d9c740', '#15232200'],
    });

    assert({
      given: 'an opacity outside 0..1',
      should: 'clamp it',
      actual: [withAlpha('#ffffff', 2), withAlpha('#ffffff', -1)],
      expected: ['#ffffffff', '#ffffff00'],
    });
  });
});
