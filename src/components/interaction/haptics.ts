/** Short controller haptic pulses (PRD §6.4). Hands and controllers without actuators are ignored. */

export type Hand = 'left' | 'right';
export type HapticPulse = { intensity: number; duration: number };
export type HapticStep = HapticPulse & { /** ms after the previous step started */ delay?: number };
export type HapticPatternName = 'click' | 'select' | 'grab' | 'release' | 'impact';

export const HAPTIC_PATTERNS: Readonly<Record<HapticPatternName, readonly HapticStep[]>> = {
  click: [{ intensity: 0.25, duration: 15 }],
  select: [{ intensity: 0.45, duration: 35 }],
  grab: [{ intensity: 0.6, duration: 50 }],
  release: [{ intensity: 0.3, duration: 25 }],
  impact: [
    { intensity: 1, duration: 40 },
    { intensity: 0.5, duration: 60, delay: 70 },
  ],
};

export type HapticActuator = { pulse(intensity: number, duration: number): Promise<unknown> | unknown };

export type HapticsOptions = {
  actuatorFor: (hand: Hand) => HapticActuator | undefined;
  schedule?: (fn: () => void, ms: number) => void;
  enabled?: boolean;
};

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export const createHaptics = ({ actuatorFor, schedule = (fn, ms) => void setTimeout(fn, ms), enabled = true }: HapticsOptions) => {
  let isEnabled = enabled;

  const pulse = (hand: Hand, { intensity, duration }: HapticPulse): boolean => {
    if (!isEnabled) return false;
    const actuator = actuatorFor(hand);
    if (!actuator) return false;
    try {
      void Promise.resolve(actuator.pulse(clamp01(intensity), Math.max(0, duration))).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  };

  const play = (hand: Hand, pattern: HapticPatternName): void => {
    const steps = HAPTIC_PATTERNS[pattern];
    const run = (index: number): void => {
      const step = steps[index];
      if (!step) return;
      schedule(() => {
        pulse(hand, step);
        run(index + 1);
      }, step.delay ?? 0);
    };
    run(0);
  };

  return {
    pulse,
    play,
    setEnabled(value: boolean): void {
      isEnabled = value;
    },
  };
};

export type Haptics = ReturnType<typeof createHaptics>;
