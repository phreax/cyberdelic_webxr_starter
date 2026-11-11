import {
  Color,
  createSystem,
  SessionMode,
  VisibilityState,
  type World,
} from '@iwsdk/core';
import { createAudioEngine, type AudioEngine, type AudioEngineOptions } from '../../components/audio/audio-engine.js';
import { createInteractionSounds, type InteractionSounds } from '../../components/audio/interaction-sounds.js';
import { createOscClient, type OscClient, type OscClientOptions } from '../../components/osc/osc-client.js';
import { createParameterStore, type ParameterStore } from '../parameters/store.js';
import { createHaptics, type Hand, type Haptics, type HapticPatternName } from '../../components/interaction/haptics.js';
import { createGrabHapticsSystem } from '../../components/interaction/manipulable.js';
import { cyberdelicTheme, type Theme } from '../../themes/cyberdelic.js';
import { clampDelta, createDisposables, createLifecycle, type Disposable, type Experience } from './lifecycle.js';
import { resolveXRMode, type ExperienceMode, type ResolvedXRMode, type XRSupport } from './mode.js';

/**
 * Thin bootstrap around an IWSDK World (PRD §4.1). Everything native stays reachable
 * through `ctx.world`; this only adds lifecycle, VR/MR entry, theme and haptics.
 */
/** Lets an experience offer the other examples (menu "Demos" row) without a page reload. */
export type ExampleSwitcher = {
  current: string;
  list: ReadonlyArray<{ id: string; title: string }>;
  switchTo(id: string): void;
};

export type ExperienceContext = {
  world: World;
  /** Present when the app hosts several examples (see src/index.ts). */
  examples?: ExampleSwitcher;
  theme: Theme;
  /** Shared parameters: UI, audio and OSC write here; visuals read here (PRD §9). */
  params: ParameterStore;
  /** Present when `audio` is enabled in the config. Sources start on a user gesture. */
  audio?: AudioEngine;
  /** Present when `osc` is enabled in the config. */
  osc?: OscClient;
  /** Synthesised UI / interaction sounds (click, select, grab, release). */
  sounds: InteractionSounds;
  /** Run `fn(dt, time)` every frame before the experience's update. Returns a remover (auto-removed on dispose). */
  onFrame(fn: (dt: number, time: number) => void): () => void;
  haptics: Haptics & {
    /** Play on the controller whose trigger or grip is held, else the right one. */
    playActive(pattern: HapticPatternName): void;
  };
  /** Register cleanup that runs when the experience is disposed. */
  track<T extends Disposable>(item: T): T;
  xr: {
    support: XRSupport;
    /** Enter immersive mode; returns the resolved mode (including any fallback reason). */
    enter(mode?: ExperienceMode): ResolvedXRMode;
    exit(): void;
  };
};

export type ExperienceConfig = {
  mode?: ExperienceMode;
  theme?: Theme;
  haptics?: boolean;
  audio?: boolean | AudioEngineOptions;
  osc?: boolean | OscClientOptions;
  /** Scene JSON to load before init (e.g. './scenes/garden.iwsdk.scene.json'). Default: the one in iwsdk.config.json. */
  level?: string;
  sounds?: boolean;
  examples?: ExampleSwitcher;
  scene: Experience<ExperienceContext>;
};

const detectSupport = async (): Promise<XRSupport> => {
  const xr = navigator.xr;
  if (!xr) return { vr: false, ar: false };
  const check = (mode: XRSessionMode) => xr.isSessionSupported(mode).catch(() => false);
  const [vr, ar] = await Promise.all([check('immersive-vr'), check('immersive-ar')]);
  return { vr, ar };
};

const HANDS: readonly Hand[] = ['right', 'left'];

/**
 * Systems are registered once per world and forward to whichever experience is active, so
 * experiences can be swapped in place (examples menu) without stacking systems up.
 */
type Runtime = { tick?: (delta: number, time: number) => void; haptics?: Haptics };
const runtimes = new WeakMap<World, Runtime>();
const runtimeFor = (world: World): Runtime => {
  let runtime = runtimes.get(world);
  if (runtime) return runtime;
  const created: Runtime = {};
  runtime = created;
  runtimes.set(world, created);
  class ExperienceRunnerSystem extends createSystem({}) {
    update(delta: number, time: number): void {
      created.tick?.(delta, time);
    }
  }
  world.registerSystem(ExperienceRunnerSystem);
  world.registerSystem(createGrabHapticsSystem({ play: (hand, pattern) => created.haptics?.play(hand, pattern) }));
  return created;
};

export const createExperience = async (world: World, config: ExperienceConfig) => {
  const theme = config.theme ?? cyberdelicTheme;
  const disposables = createDisposables();
  const support = await detectSupport();

  const gamepad = (hand: Hand) => world.input.xr.gamepads[hand];
  const haptics = createHaptics({
    enabled: config.haptics ?? true,
    actuatorFor: (hand) => {
      const actuators = (gamepad(hand)?.gamepad as (Gamepad & { hapticActuators?: readonly unknown[] }) | undefined)
        ?.hapticActuators;
      const actuator = actuators?.[0] as { pulse?: (i: number, d: number) => Promise<boolean> } | undefined;
      return actuator?.pulse ? { pulse: (i, d) => actuator.pulse!(i, d) } : undefined;
    },
  });
  const activeHand = (): Hand =>
    HANDS.find((hand) => {
      const pad = gamepad(hand);
      return pad?.getButtonPressed('xr-standard-trigger') || pad?.getButtonPressed('xr-standard-squeeze');
    }) ?? 'right';

  // Themed background in VR and the browser. IWSDK clears it during passthrough AR sessions and restores it after.
  world.scene.background = new Color(theme.colors.background);

  if (config.level) await world.loadLevel(config.level);

  const params = createParameterStore();
  const sounds = disposables.add(createInteractionSounds());
  sounds.setEnabled(config.sounds ?? true);
  const frameCallbacks = new Set<(dt: number, time: number) => void>();
  disposables.add(() => frameCallbacks.clear());
  const audio = config.audio ? disposables.add(createAudioEngine(config.audio === true ? {} : config.audio)) : undefined;
  const osc = config.osc ? disposables.add(createOscClient(config.osc === true ? {} : config.osc)) : undefined;

  const ctx: ExperienceContext = {
    world,
    theme,
    examples: config.examples,
    params,
    audio,
    osc,
    sounds,
    onFrame(fn) {
      frameCallbacks.add(fn);
      return () => frameCallbacks.delete(fn);
    },
    haptics: { ...haptics, playActive: (pattern) => haptics.play(activeHand(), pattern) },
    track: (item) => disposables.add(item),
    xr: {
      support,
      enter(mode = config.mode ?? 'vr') {
        const resolved = resolveXRMode(mode, support);
        if (resolved.mode === null) {
          console.warn(`[cyberdelic] ${resolved.reason}`);
          return resolved;
        }
        if (resolved.fallbackReason) console.info(`[cyberdelic] ${resolved.fallbackReason}`);
        world.launchXR({
          sessionMode: resolved.session === 'immersive-ar' ? SessionMode.ImmersiveAR : SessionMode.ImmersiveVR,
        });
        return resolved;
      },
      exit() {
        if (world.visibilityState.peek() !== VisibilityState.NonImmersive) world.exitXR();
      },
    },
  };

  const lifecycle = createLifecycle(config.scene, ctx);

  const runtime = runtimeFor(world);
  // Order per frame: audio analysis → parameters (modulation + smoothing) → frame hooks → experience.
  const tick = (delta: number, time: number) => {
    const dt = clampDelta(delta);
    audio?.update(dt);
    params.update(dt);
    frameCallbacks.forEach((fn) => fn(dt, time));
    lifecycle.tick(delta, time);
  };
  runtime.tick = tick;
  runtime.haptics = haptics;
  lifecycle.start();

  const dispose = () => {
    if (runtime.tick === tick) {
      runtime.tick = undefined;
      runtime.haptics = undefined;
    }
    lifecycle.stop();
    disposables.disposeAll();
  };

  return { ctx, dispose };
};
