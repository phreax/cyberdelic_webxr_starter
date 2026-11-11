/** Pure value math behind the spatial controls. UIKit local x/y run -0.5..0.5 across an element. */

export type ValueRange = { min: number; max: number; step?: number };

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Snap to `step` (counted from `min`), then clamp. `step` 0/undefined means continuous. */
export const quantize = (value: number, { min, max, step }: ValueRange): number => {
  const snapped = step ? min + Math.round((value - min) / step) * step : value;
  return clamp(Number(snapped.toFixed(10)), min, max);
};

export const normalize = (value: number, { min, max }: ValueRange): number =>
  max === min ? 0 : clamp((value - min) / (max - min), 0, 1);

export const sliderValueFromLocalX = (localX: number, range: ValueRange): number =>
  quantize(range.min + (localX + 0.5) * (range.max - range.min), range);

export type KnobOptions = ValueRange & {
  /** Full range change per knob height of vertical drag. */
  sensitivity?: number;
};

/** Vertical drag: up increases. `dragY` is in knob heights (local units) since the drag started. */
export const knobValueFromDrag = (startValue: number, dragY: number, options: KnobOptions): number =>
  quantize(startValue + dragY * (options.sensitivity ?? 1) * (options.max - options.min), options);

export const KNOB_SWEEP_DEG = 270;

/** Indicator rotation (counter-clockwise degrees): min at +135, max at -135, middle straight up. */
export const knobAngleDeg = (value: number, range: ValueRange, sweep = KNOB_SWEEP_DEG): number =>
  sweep / 2 - normalize(value, range) * sweep + 0;
