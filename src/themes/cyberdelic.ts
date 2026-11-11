/** Cyberdelic design tokens (PRD §5.2 / §5.6). UIKit takes colours and opacities separately. */
export type Theme = {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  panel: {
    /** Surface opacity: the frosted-glass fallback (UIKit has no backdrop blur). */
    opacity: number;
    radius: number;
    borderWidth: number;
    borderIntensity: number;
  };
  animation: { duration: number; easing: 'easeOut' | 'linear' };
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const cyberdelicTheme: Readonly<Theme> = Object.freeze({
  colors: Object.freeze({
    primary: '#00D9C7',
    secondary: '#FF9500',
    background: '#071514',
    surface: '#152322',
    text: '#F1F7F5',
    muted: '#9BAEAB',
  }),
  panel: Object.freeze({ opacity: 0.85, radius: 16, borderWidth: 1.5, borderIntensity: 0.25 }),
  animation: Object.freeze({ duration: 180, easing: 'easeOut' as const }),
});

export const defineTheme = (overrides: DeepPartial<Theme> = {}, base: Theme = cyberdelicTheme): Theme => ({
  colors: { ...base.colors, ...overrides.colors },
  panel: { ...base.panel, ...overrides.panel },
  animation: { ...base.animation, ...overrides.animation },
});

export type ControlState = { hovered: boolean; pressed: boolean; selected: boolean; disabled: boolean };

/** `#rrggbb` + opacity → `#rrggbbaa` (UIKit reads alpha from the colour; there is no backgroundOpacity). */
export const withAlpha = (hex: string, opacity: number): string => {
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${hex.toLowerCase()}${alpha.toString(16).padStart(2, '0')}`;
};

export type ControlStyle = { backgroundColor: string; borderColor: string; color: string };

/** Frosted-glass panel surface: translucent fill, low-opacity neon border. */
export const panelStyle = (theme: Theme) => ({
  backgroundColor: withAlpha(theme.colors.surface, theme.panel.opacity),
  borderColor: withAlpha(theme.colors.primary, theme.panel.borderIntensity),
  borderRadius: theme.panel.radius,
});

const style = (background: string, backgroundOpacity: number, border: string, borderOpacity: number, color: string): ControlStyle => ({
  backgroundColor: withAlpha(background, backgroundOpacity),
  borderColor: withAlpha(border, borderOpacity),
  color,
});

/** Visual style of an interactive control. Disabled wins, then pressed, selected, hovered. */
export const controlStyle = (theme: Theme, state: ControlState): ControlStyle => {
  const { colors, panel } = theme;
  if (state.disabled) return style(colors.surface, 0.4, colors.muted, 0.15, colors.muted);
  if (state.pressed) return style(colors.primary, 0.55, colors.primary, 1, colors.text);
  if (state.selected) return style(colors.primary, 0.3, colors.primary, 0.9, colors.text);
  if (state.hovered) return style(colors.primary, 0.16, colors.primary, 0.7, colors.text);
  return style(colors.background, 0.55, colors.primary, panel.borderIntensity, colors.text);
};
