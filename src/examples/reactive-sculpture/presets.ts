import type { ParameterStore } from '../../core/parameters/store.js';

/** Named looks for the Reactive Sculpture. Each names only the parameters it changes. */
export type Preset = Readonly<Record<string, number>>;

export const SCULPTURE_PRESETS = {
  Coral: { growth: 0.45, complexity: 1.6, twist: 0.8, flow: 0.4, hue: 0, glow: 0.35 },
  Nebula: { growth: 0.7, complexity: 0.9, twist: -1.6, flow: 0.25, hue: 0.62, glow: 0.7 },
  Ember: { growth: 0.3, complexity: 3.2, twist: 0.2, flow: 0.9, hue: 0.9, glow: 0.5 },
  Void: { growth: 0.15, complexity: 2.4, twist: 2.6, flow: 0.15, hue: 0.4, glow: 0.1 },
} as const satisfies Record<string, Preset>;

export type SculpturePresetName = keyof typeof SCULPTURE_PRESETS;

/** Set every parameter the preset names; unknown ids are ignored, others untouched. */
export const applyPreset = (params: Pick<ParameterStore, 'apply'>, preset: Preset): void => params.apply(preset, 'preset');

/** Name of the preset whose values all match `values` (within tolerance), if any. */
export const activePreset = <Name extends string>(
  values: Readonly<Record<string, number>>,
  presets: Readonly<Record<Name, Preset>>,
  tolerance = 1e-3,
): Name | undefined =>
  (Object.keys(presets) as Name[]).find((name) =>
    Object.entries(presets[name]).every(([id, value]) => id in values && Math.abs(values[id]! - value) <= tolerance),
  );
