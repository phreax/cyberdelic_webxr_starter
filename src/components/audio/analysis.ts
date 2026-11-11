/** Pure audio signal math. Inputs are AnalyserNode arrays; outputs are 0..1 unless noted. */

export const rms = (samples: ArrayLike<number>): number => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / samples.length);
};

/** Mean energy (0..1) of byte-spectrum bins whose frequency lies in [fromHz, toHz). */
export const bandEnergy = (
  spectrum: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  fromHz: number,
  toHz: number,
): number => {
  const hzPerBin = sampleRate / fftSize;
  const first = Math.max(0, Math.ceil(fromHz / hzPerBin));
  const last = Math.min(spectrum.length - 1, Math.ceil(toHz / hzPerBin) - 1);
  if (last < first) return 0;
  let sum = 0;
  for (let i = first; i <= last; i += 1) sum += spectrum[i]!;
  return sum / ((last - first + 1) * 255);
};

export const BANDS = {
  bass: [20, 250],
  mid: [250, 2000],
  high: [2000, 16000],
} as const;

/** Energy rise detector: true once when energy jumps by `threshold`, then quiet for `cooldown` seconds. */
export const createOnsetDetector = ({ threshold = 0.15, cooldown = 0.1 } = {}) => {
  let previous = 0;
  let wait = 0;
  return (energy: number, dt: number): boolean => {
    wait -= dt;
    const rise = energy - previous;
    previous = energy;
    if (rise >= threshold && wait <= 0) {
      wait = cooldown;
      return true;
    }
    return false;
  };
};

/**
 * Beat estimate from bass energy: fires when energy exceeds its running average by a ratio
 * and margin, at most once per `cooldown` seconds.
 */
export const createBeatDetector = ({ ratio = 1.4, margin = 0.05, window = 1, cooldown = 0.25 } = {}) => {
  let average: number | undefined;
  let wait = 0;
  return (energy: number, dt: number): boolean => {
    wait -= dt;
    if (average === undefined) {
      average = energy;
      return false;
    }
    const isBeat = wait <= 0 && energy > average * ratio && energy > average + margin;
    average += (energy - average) * (1 - Math.exp(-dt / window));
    if (isBeat) wait = cooldown;
    return isBeat;
  };
};

/** Exponential smoothing step toward `target` with time constant `tau` seconds. */
export const smoothToward = (current: number, target: number, dt: number, tau: number): number =>
  tau <= 0 ? target : current + (target - current) * (1 - Math.exp(-dt / tau));
