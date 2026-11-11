import type { AudioEngine, AudioSignal } from '../../components/audio/audio-engine.js';
import type { OscClient } from '../../components/osc/osc-client.js';
import { normalizeInput } from '../../components/osc/osc-utils.js';
import type { Modulator, ParameterStore } from './store.js';

/** Glue between the parameter store and inputs (PRD §9.3). */

/** Audio signal → parameter modulation. Default: add, 40% of range. */
export const bindAudio = (
  params: ParameterStore,
  audio: Pick<AudioEngine, 'get'>,
  signal: AudioSignal,
  id: string,
  options: Omit<Modulator, 'read'> | { amount?: number } = {},
): (() => void) =>
  params.modulate(id, { mode: 'add', amount: 0.4, ...options, read: () => audio.get(signal) });

/** A UI control with a settable value (slider, knob, toggle). */
export type ValueControl<T> = { setValue(value: T): void };

/**
 * Two-way UI binding. Create the control with `controlOptions(params, id)` so user changes write
 * to the store; this keeps the control in sync when OSC / presets / code change the value.
 */
export const bindUI = (params: ParameterStore, id: string, control: ValueControl<number> | ValueControl<boolean>) =>
  params.subscribe(id, (value, source) => {
    if (source === 'ui') return;
    const definition = params.definition(id);
    (control as ValueControl<number | boolean>).setValue(definition.type === 'boolean' ? value >= 0.5 : value);
  });

export const controlOptions = (params: ParameterStore, id: string) => {
  const { min, max } = params.definition(id);
  return {
    min,
    max,
    value: params.getBase(id),
    onChange: (value: number) => params.set(id, value, 'ui'),
  };
};

export const toggleOptions = (params: ParameterStore, id: string) => ({
  value: params.getBase(id) >= 0.5,
  onChange: (value: boolean) => params.set(id, value ? 1 : 0, 'ui'),
});

/** OSC address → parameter base value, rescaled from `inputRange` (default 0..1) into the parameter range. */
export const bindOSC = (
  params: ParameterStore,
  osc: Pick<OscClient, 'on'>,
  address: string,
  id: string,
  { inputRange = [0, 1] as readonly [number, number] } = {},
): (() => void) =>
  osc.on(address, (args) => {
    const raw = Number(args[0]);
    if (!Number.isFinite(raw)) return;
    const { min, max } = params.definition(id);
    params.set(id, normalizeInput(raw, inputRange, [min, max]), 'osc');
  });
