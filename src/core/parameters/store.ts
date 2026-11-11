/**
 * Central parameter registry + modulation (PRD §9). Framework-free and deterministic.
 *
 * Each frame (`update(dt)`), a parameter's target is computed in a fixed order:
 *   base → replace (last registered wins, blended by amount) → + add/trigger → × multiply → clamp
 * and the current value eases toward the target with exponential smoothing (seconds).
 */

export type ParameterType = 'number' | 'boolean';
export type ParameterSource = 'default' | 'ui' | 'osc' | 'preset' | 'code' | (string & {});

export type ParameterDefinition = {
  default: number;
  min?: number;
  max?: number;
  type?: ParameterType;
  /** Time constant in seconds; 0 = immediate. */
  smoothing?: number;
  label?: string;
  meta?: Record<string, unknown>;
};

export type ModulationMode = 'replace' | 'add' | 'multiply' | 'trigger';

export type Modulator = {
  read: () => number;
  mode: ModulationMode;
  /** replace: blend 0..1 · add/trigger: fraction of range · multiply: factor = 1 + amount × input. */
  amount?: number;
  /** Input range mapped to 0..1 before applying; values outside are clamped. */
  inputRange?: readonly [number, number];
  /** trigger: input level counted as "high". */
  threshold?: number;
  /** trigger: seconds to decay from 1 to 0. */
  decay?: number;
};

type Parameter = Required<Pick<ParameterDefinition, 'default' | 'min' | 'max' | 'type' | 'smoothing'>> &
  Pick<ParameterDefinition, 'label' | 'meta'> & {
    id: string;
    base: number;
    target: number;
    current: number;
    modulators: Array<Modulator & { pulse: number; wasHigh: boolean }>;
    listeners: Set<(value: number, source: ParameterSource) => void>;
  };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const unit = (value: number, [from, to]: readonly [number, number] = [0, 1]) =>
  to === from ? 0 : clamp((value - from) / (to - from), 0, 1);

export const createParameterStore = () => {
  const parameters = new Map<string, Parameter>();

  const require = (id: string): Parameter => {
    const parameter = parameters.get(id);
    if (!parameter) throw new Error(`Unknown parameter "${id}"`);
    return parameter;
  };

  const fit = (p: Parameter, value: number) => {
    const clamped = clamp(Number.isFinite(value) ? value : p.default, p.min, p.max);
    return p.type === 'boolean' ? (clamped >= 0.5 ? 1 : 0) : clamped;
  };

  const computeTarget = (p: Parameter, dt: number): number => {
    const range = p.max - p.min;
    let value = p.base;
    let added = 0;
    let factor = 1;
    for (const m of p.modulators) {
      const input = unit(m.read(), m.inputRange);
      const amount = m.amount ?? 1;
      if (m.mode === 'replace') value = p.base + (p.min + input * range - p.base) * clamp(amount, 0, 1);
      else if (m.mode === 'add') added += input * amount * range;
      else if (m.mode === 'multiply') factor *= 1 + amount * input;
      else {
        m.pulse = m.decay && m.decay > 0 ? Math.max(0, m.pulse - dt / m.decay) : 0;
        const high = input >= (m.threshold ?? 0.5);
        if (high && !m.wasHigh) m.pulse = 1;
        m.wasHigh = high;
        added += m.pulse * amount * range;
      }
    }
    return fit(p, (value + added) * factor);
  };

  const set = (id: string, value: number, source: ParameterSource = 'code'): void => {
    const p = require(id);
    p.base = fit(p, value);
    p.listeners.forEach((listener) => listener(p.base, source));
  };

  return {
    define(id: string, definition: ParameterDefinition): void {
      const min = definition.min ?? 0;
      const max = definition.max ?? 1;
      const type = definition.type ?? 'number';
      const value = clamp(definition.default, min, max);
      parameters.set(id, {
        id,
        default: value,
        min,
        max,
        type,
        smoothing: definition.smoothing ?? 0,
        label: definition.label,
        meta: definition.meta,
        base: value,
        target: value,
        current: value,
        modulators: parameters.get(id)?.modulators ?? [],
        listeners: parameters.get(id)?.listeners ?? new Set(),
      });
    },
    has: (id: string) => parameters.has(id),
    /** Smoothed, modulated value. */
    get: (id: string) => require(id).current,
    /** Modulated target before smoothing. */
    getTarget: (id: string) => require(id).target,
    /** Unmodulated base value (what UI / OSC / presets set). */
    getBase: (id: string) => require(id).base,
    definition: (id: string) => {
      const { default: def, min, max, type, smoothing, label, meta } = require(id);
      return { default: def, min, max, type, smoothing, label, meta };
    },
    ids: () => [...parameters.keys()],
    set,
    reset: (id: string, source: ParameterSource = 'default'): void => set(id, require(id).default, source),
    /** Set many base values; unknown ids are ignored (presets, OSC bundles). */
    apply(values: Readonly<Record<string, number>>, source: ParameterSource = 'preset'): void {
      for (const [id, value] of Object.entries(values)) if (parameters.has(id)) set(id, value, source);
    },
    snapshot: (): Record<string, number> => Object.fromEntries([...parameters.values()].map((p) => [p.id, p.base])),
    /** Notified on base changes (not on every modulated frame). */
    subscribe(id: string, listener: (value: number, source: ParameterSource) => void): () => void {
      const { listeners } = require(id);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    modulate(id: string, modulator: Modulator): () => void {
      const p = require(id);
      const entry = { ...modulator, pulse: 0, wasHigh: false };
      p.modulators.push(entry);
      // Keep mode order deterministic regardless of registration order (stable within a mode).
      const rank: Record<ModulationMode, number> = { replace: 0, add: 1, trigger: 1, multiply: 2 };
      p.modulators.sort((a, b) => rank[a.mode] - rank[b.mode]);
      return () => {
        const index = p.modulators.indexOf(entry);
        if (index >= 0) p.modulators.splice(index, 1);
      };
    },
    update(dt: number): void {
      for (const p of parameters.values()) {
        p.target = computeTarget(p, dt);
        const alpha = p.smoothing > 0 ? 1 - Math.exp(-Math.max(0, dt) / p.smoothing) : 1;
        p.current = alpha >= 1 ? p.target : p.current + (p.target - p.current) * alpha;
        if (Math.abs(p.current - p.target) < 1e-9) p.current = p.target;
      }
    },
  };
};

export type ParameterStore = ReturnType<typeof createParameterStore>;
