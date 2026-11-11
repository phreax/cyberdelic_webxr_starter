/**
 * Synthesised UI / interaction sounds (PRD §5.4 "configurable interaction sounds"): no assets,
 * created lazily on first play so they never start before a user gesture.
 */
export type InteractionSoundName = 'click' | 'select' | 'grab' | 'release';
export type ToneSpec = { frequency: number; to?: number; duration: number; type: OscillatorType; gain: number };

export const INTERACTION_SOUNDS: Record<InteractionSoundName, ToneSpec> = {
  click: { frequency: 1800, duration: 0.03, type: 'sine', gain: 0.12 },
  select: { frequency: 660, to: 990, duration: 0.08, type: 'triangle', gain: 0.12 },
  grab: { frequency: 220, to: 330, duration: 0.09, type: 'triangle', gain: 0.15 },
  release: { frequency: 330, to: 200, duration: 0.09, type: 'triangle', gain: 0.1 },
};

export const createInteractionSounds = ({
  createContext = () => new AudioContext() as AudioContext | undefined,
  volume = 1,
  sounds = INTERACTION_SOUNDS,
}: {
  createContext?: () => AudioContext | undefined;
  volume?: number;
  sounds?: Record<InteractionSoundName, ToneSpec>;
} = {}) => {
  let context: AudioContext | undefined;
  let created = false;
  let enabled = true;

  return {
    setEnabled(value: boolean) {
      enabled = value;
    },
    play(name: InteractionSoundName): void {
      if (!enabled) return;
      if (!created) {
        created = true;
        context = createContext();
      }
      if (!context) return;
      if (context.state === 'suspended') void context.resume();
      const spec = sounds[name];
      const t = context.currentTime;
      const osc = context.createOscillator();
      const env = context.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.frequency, t);
      if (spec.to) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.duration);
      env.gain.setValueAtTime(spec.gain * volume, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + spec.duration);
      osc.connect(env).connect(context.destination);
      osc.start(t);
      osc.stop(t + spec.duration + 0.02);
    },
    dispose() {
      void context?.close();
      context = undefined;
    },
  };
};

export type InteractionSounds = ReturnType<typeof createInteractionSounds>;
