import type { ParameterStore } from '../../core/parameters/store.js';
import { cyberdelicTheme } from '../../themes/cyberdelic.js';
import { hexToHsv, hsvToHex } from './color.js';
import { bindButton, bindSlider, requireElement, type BindOptions, type ElementSource } from './controls.js';

/**
 * Composite controls built on the basic binders. Markup conventions (element ids) are listed per
 * binder; see public/ui/playground-panel.uikitml for working examples.
 */

/** Label / ValueDisplay: a text element showing a formatted value. */
export const bindValueDisplay = (
  source: ElementSource,
  id: string,
  format: (value: number) => string = (v) => v.toFixed(2),
) => {
  const element = requireElement(source, id);
  let last = '';
  return (value: number) => {
    const text = format(value);
    if (text === last) return; // avoid relayout when nothing changed
    last = text;
    element.setProperties({ text });
  };
};

/**
 * Dropdown. Elements: `${id}` (button), `${id}-label`, `${id}-list` (hidden container),
 * `${id}-option-${i}` per option.
 */
export const bindDropdown = <T extends string>(
  source: ElementSource,
  id: string,
  options: BindOptions & { options: readonly T[]; labels?: Readonly<Record<T, string>>; value?: T; onChange: (value: T) => void },
) => {
  const label = requireElement(source, `${id}-label`);
  const list = requireElement(source, `${id}-list`);
  let open = false;
  let value = options.value ?? options.options[0]!;
  const text = (option: T) => options.labels?.[option] ?? option;
  const setOpen = (next: boolean) => {
    open = next;
    list.setProperties({ display: open ? 'flex' : 'none' });
  };
  const optionButtons = options.options.map((option, index) =>
    bindButton(source, `${id}-option-${index}`, {
      ...options,
      selected: option === value,
      onClick: () => {
        select(option);
        setOpen(false);
        options.onChange(option);
      },
    }),
  );
  const select = (option: T) => {
    value = option;
    label.setProperties({ text: text(option) });
    optionButtons.forEach((button, i) => button.setSelected(options.options[i] === option));
  };
  const toggle = bindButton(source, id, { ...options, onClick: () => setOpen(!open) });
  select(value);
  setOpen(false);
  return {
    get value() {
      return value;
    },
    setValue: select,
    close: () => setOpen(false),
    setDisabled: (disabled: boolean) => toggle.setDisabled(disabled),
    dispose: () => {
      toggle.dispose();
      optionButtons.forEach((button) => button.dispose());
    },
  };
};

/**
 * ColorPicker: palette swatches plus a hue slider. Elements: `${id}-swatch-${i}`, `${id}-hue`
 * (+ `-fill`), `${id}-preview`. Emits `#rrggbb`.
 */
export const bindColorPicker = (
  source: ElementSource,
  id: string,
  options: BindOptions & { palette: readonly string[]; value?: string; onChange: (hex: string) => void },
) => {
  const preview = requireElement(source, `${id}-preview`);
  let color = options.value ?? options.palette[0] ?? cyberdelicTheme.colors.primary;
  const render = () => preview.setProperties({ backgroundColor: color });
  const swatches = options.palette.map((hex, i) => {
    requireElement(source, `${id}-swatch-${i}`).setProperties({ backgroundColor: hex });
    return bindButton(source, `${id}-swatch-${i}`, {
      ...options,
      onClick: () => {
        set(hex);
        options.onChange(color);
      },
    });
  });
  const hue = bindSlider(source, `${id}-hue`, {
    ...options,
    min: 0,
    max: 1,
    step: 0.005,
    value: hexToHsv(color).h,
    format: (h) => `${Math.round(h * 360)}°`,
    onChange: (h) => {
      const hsv = hexToHsv(color);
      // Keep greys pickable: give an unsaturated colour some saturation when the hue moves.
      color = hsvToHex({ h, s: hsv.s < 0.05 ? 0.8 : hsv.s, v: hsv.v < 0.05 ? 0.9 : hsv.v });
      render();
      highlight();
      options.onChange(color);
    },
  });
  const highlight = () => swatches.forEach((swatch, i) => swatch.setSelected(options.palette[i]!.toLowerCase() === color.toLowerCase()));
  const set = (hex: string) => {
    color = hex.toLowerCase();
    hue.setValue(hexToHsv(color).h);
    render();
    highlight();
  };
  set(color);
  return {
    get value() {
      return color;
    },
    setValue: set,
    setDisabled: (disabled: boolean) => {
      swatches.forEach((s) => s.setDisabled(disabled));
      hue.setDisabled(disabled);
    },
    dispose: () => {
      swatches.forEach((s) => s.dispose());
      hue.dispose();
    },
  };
};

/**
 * PresetSelector: one button per preset (`${prefix}-${name.toLowerCase()}`), applied through the
 * parameter store; the button whose values match the live parameters is shown as selected.
 */
export const bindPresetSelector = (
  source: ElementSource,
  prefix: string,
  options: BindOptions & {
    params: Pick<ParameterStore, 'apply' | 'snapshot' | 'subscribe' | 'ids'>;
    presets: Readonly<Record<string, Readonly<Record<string, number>>>>;
    tolerance?: number;
  },
) => {
  const { params, presets, tolerance = 1e-3 } = options;
  const names = Object.keys(presets);
  const buttons = names.map((name) =>
    bindButton(source, `${prefix}-${name.toLowerCase()}`, { ...options, onClick: () => params.apply(presets[name]!, 'preset') }),
  );
  const refresh = () => {
    const values = params.snapshot();
    const active = names.find((name) =>
      Object.entries(presets[name]!).every(([id, v]) => id in values && Math.abs(values[id]! - v) <= tolerance),
    );
    buttons.forEach((button, i) => button.setSelected(names[i] === active));
  };
  const offs = params.ids().map((id) => params.subscribe(id, refresh));
  refresh();
  return {
    refresh,
    dispose: () => {
      offs.forEach((off) => off());
      buttons.forEach((button) => button.dispose());
    },
  };
};
