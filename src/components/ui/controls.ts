import { Vector3 } from '@iwsdk/core';
import { controlStyle, cyberdelicTheme, type ControlState, type Theme } from '../../themes/cyberdelic.js';
import {
  knobAngleDeg,
  knobValueFromDrag,
  normalize,
  quantize,
  sliderValueFromLocalX,
  type KnobOptions,
  type ValueRange,
} from './control-math.js';

/**
 * Runtime binders that turn plain UIKitML elements into themed controls.
 * Works with controller rays, hand rays/pinch and the mouse: all arrive as UIKit pointer events.
 */

type PointerLike = { point: Vector3; pointerId?: number; stopPropagation?: () => void; target?: unknown };
type Listener = (event: PointerLike) => void;

/** The subset of a UIKit element the binders rely on. */
export type UIElement = {
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  setProperties(properties: Record<string, unknown>): void;
  worldToLocal(vector: Vector3): Vector3;
};

export type ElementSource = { getElementById(id: string): unknown };

export type Feedback = 'hover' | 'press' | 'change';

export type BindOptions = {
  theme?: Theme;
  disabled?: boolean;
  /** Hook for haptics / sounds. */
  onFeedback?: (kind: Feedback) => void;
};

export type Control<T = void> = {
  dispose(): void;
  setDisabled(disabled: boolean): void;
} & ([T] extends [void] ? unknown : { readonly value: T; setValue(value: T): void });

export const requireElement = (source: ElementSource, id: string): UIElement => {
  const element = source.getElementById(id) as UIElement | undefined;
  if (!element) throw new Error(`UI element "${id}" not found`);
  return element;
};

const optionalElement = (source: ElementSource, id: string): UIElement | undefined =>
  (source.getElementById(id) as UIElement | undefined) ?? undefined;

const listen = (element: UIElement, type: string, listener: Listener) => {
  element.addEventListener(type, listener);
  return () => element.removeEventListener(type, listener);
};

const capture = (event: PointerLike) => {
  const target = event.target as { setPointerCapture?: (id: number) => void } | undefined;
  if (event.pointerId != null) target?.setPointerCapture?.(event.pointerId);
};

/** Hover/press/selected/disabled styling shared by every control. */
const createInteractive = (element: UIElement, options: BindOptions, onState?: (state: ControlState) => void) => {
  const theme = options.theme ?? cyberdelicTheme;
  const state: ControlState = { hovered: false, pressed: false, selected: false, disabled: options.disabled ?? false };
  const render = () => {
    element.setProperties({ ...controlStyle(theme, state), cursor: state.disabled ? 'default' : 'pointer' });
    onState?.(state);
  };
  const set = (patch: Partial<ControlState>) => {
    Object.assign(state, patch);
    render();
  };
  const offs = [
    listen(element, 'pointerenter', () => {
      if (state.disabled) return;
      set({ hovered: true });
      options.onFeedback?.('hover');
    }),
    listen(element, 'pointerleave', () => set({ hovered: false, pressed: false })),
    listen(element, 'pointerdown', () => {
      if (!state.disabled) set({ pressed: true });
    }),
    listen(element, 'pointerup', () => set({ pressed: false })),
  ];
  render();
  return {
    state,
    set,
    dispose: () => offs.forEach((off) => off()),
  };
};

export const bindButton = (
  source: ElementSource,
  id: string,
  options: BindOptions & { onClick: () => void },
): Control => {
  const element = requireElement(source, id);
  const interactive = createInteractive(element, options);
  const off = listen(element, 'click', () => {
    if (interactive.state.disabled) return;
    options.onFeedback?.('press');
    options.onClick();
  });
  return {
    dispose: () => {
      off();
      interactive.dispose();
    },
    setDisabled: (disabled) => interactive.set({ disabled }),
  };
};

/** Elements: `${id}` (pill) and `${id}-thumb`. */
export const bindToggle = (
  source: ElementSource,
  id: string,
  options: BindOptions & { value?: boolean; onChange: (value: boolean) => void },
): Control<boolean> => {
  const element = requireElement(source, id);
  const thumb = optionalElement(source, `${id}-thumb`);
  const theme = options.theme ?? cyberdelicTheme;
  let value = options.value ?? false;
  const interactive = createInteractive(element, options);
  const render = () => {
    interactive.set({ selected: value });
    element.setProperties({ justifyContent: value ? 'flex-end' : 'flex-start' });
    thumb?.setProperties({ backgroundColor: value ? theme.colors.primary : theme.colors.muted });
  };
  const off = listen(element, 'click', () => {
    if (interactive.state.disabled) return;
    value = !value;
    render();
    options.onFeedback?.('change');
    options.onChange(value);
  });
  render();
  return {
    get value() {
      return value;
    },
    setValue(next) {
      value = next;
      render();
    },
    dispose: () => {
      off();
      interactive.dispose();
    },
    setDisabled: (disabled) => interactive.set({ disabled }),
  };
};

type ValueControlOptions = BindOptions &
  ValueRange & { value?: number; onChange: (value: number) => void; format?: (value: number) => string };

const defaultFormat = (value: number) => (Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2));

/** Elements: `${id}` (track / hit area), `${id}-fill`, optional `${id}-value`. */
export const bindSlider = (source: ElementSource, id: string, options: ValueControlOptions): Control<number> => {
  const track = requireElement(source, id);
  const fill = requireElement(source, `${id}-fill`);
  const label = optionalElement(source, `${id}-value`);
  const format = options.format ?? defaultFormat;
  const local = new Vector3();
  let value = quantize(options.value ?? options.min, options);
  let dragging: number | undefined;
  const interactive = createInteractive(track, options);

  const render = () => {
    fill.setProperties({ width: `${(normalize(value, options) * 100).toFixed(2)}%` });
    label?.setProperties({ text: format(value) });
  };
  const update = (event: PointerLike) => {
    local.copy(event.point);
    track.worldToLocal(local);
    const next = sliderValueFromLocalX(local.x, options);
    event.stopPropagation?.();
    if (next === value) return;
    value = next;
    render();
    options.onChange(value);
  };
  const offs = [
    listen(track, 'pointerdown', (event) => {
      if (interactive.state.disabled || dragging != null) return;
      dragging = event.pointerId ?? -1;
      capture(event);
      options.onFeedback?.('press');
      update(event);
    }),
    listen(track, 'pointermove', (event) => {
      if (dragging != null && (event.pointerId ?? -1) === dragging) update(event);
    }),
    listen(track, 'pointerup', () => {
      if (dragging != null) options.onFeedback?.('change');
      dragging = undefined;
    }),
  ];
  render();
  return {
    get value() {
      return value;
    },
    setValue(next) {
      value = quantize(next, options);
      render();
    },
    dispose: () => {
      offs.forEach((off) => off());
      interactive.dispose();
    },
    setDisabled: (disabled) => interactive.set({ disabled }),
  };
};

/** Elements: `${id}` (dial / hit area), `${id}-indicator` (rotated), optional `${id}-value`. */
export const bindKnob = (
  source: ElementSource,
  id: string,
  options: ValueControlOptions & Pick<KnobOptions, 'sensitivity'>,
): Control<number> => {
  const dial = requireElement(source, id);
  const indicator = requireElement(source, `${id}-indicator`);
  const label = optionalElement(source, `${id}-value`);
  const format = options.format ?? defaultFormat;
  const local = new Vector3();
  let value = quantize(options.value ?? options.min, options);
  let drag: { pointerId: number; startY: number; startValue: number } | undefined;
  const interactive = createInteractive(dial, options);

  const render = () => {
    indicator.setProperties({ transformRotateZ: knobAngleDeg(value, options) });
    label?.setProperties({ text: format(value) });
  };
  const localY = (event: PointerLike) => {
    local.copy(event.point);
    dial.worldToLocal(local);
    return local.y;
  };
  const offs = [
    listen(dial, 'pointerdown', (event) => {
      if (interactive.state.disabled || drag) return;
      drag = { pointerId: event.pointerId ?? -1, startY: localY(event), startValue: value };
      capture(event);
      options.onFeedback?.('press');
      event.stopPropagation?.();
    }),
    listen(dial, 'pointermove', (event) => {
      if (!drag || (event.pointerId ?? -1) !== drag.pointerId) return;
      const next = knobValueFromDrag(drag.startValue, localY(event) - drag.startY, {
        ...options,
        sensitivity: options.sensitivity ?? 1,
      });
      event.stopPropagation?.();
      if (next === value) return;
      value = next;
      render();
      options.onChange(value);
    }),
    listen(dial, 'pointerup', () => {
      if (drag) options.onFeedback?.('change');
      drag = undefined;
    }),
  ];
  render();
  return {
    get value() {
      return value;
    },
    setValue(next) {
      value = quantize(next, options);
      render();
    },
    dispose: () => {
      offs.forEach((off) => off());
      interactive.dispose();
    },
    setDisabled: (disabled) => interactive.set({ disabled }),
  };
};

/** Each tab is a button element; its page is shown only while selected. */
export const bindTabs = (
  source: ElementSource,
  tabs: ReadonlyArray<{ tab: string; page: string }>,
  options: BindOptions & { selected?: number; onChange?: (index: number) => void },
): Control<number> => {
  let selected = options.selected ?? 0;
  const pages = tabs.map(({ page }) => requireElement(source, page));
  const controls = tabs.map(({ tab }, index) => {
    const element = requireElement(source, tab);
    const interactive = createInteractive(element, options);
    const off = listen(element, 'click', () => {
      if (interactive.state.disabled || index === selected) return;
      select(index);
      options.onFeedback?.('change');
      options.onChange?.(index);
    });
    return { interactive, off };
  });
  const select = (index: number) => {
    selected = Math.max(0, Math.min(tabs.length - 1, index));
    controls.forEach(({ interactive }, i) => interactive.set({ selected: i === selected }));
    pages.forEach((page, i) => page.setProperties({ display: i === selected ? 'flex' : 'none' }));
  };
  select(selected);
  return {
    get value() {
      return selected;
    },
    setValue: select,
    dispose: () =>
      controls.forEach(({ interactive, off }) => {
        off();
        interactive.dispose();
      }),
    setDisabled: (disabled) => controls.forEach(({ interactive }) => interactive.set({ disabled })),
  };
};
