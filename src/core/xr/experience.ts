import {
  Color,
  createSystem,
  SessionMode,
  VisibilityState,
  type World,
} from '@iwsdk/core';
import { createHaptics, type Hand, type Haptics, type HapticPatternName } from '../../components/interaction/haptics.js';
import { cyberdelicTheme, type Theme } from '../../themes/cyberdelic.js';
import { createDisposables, createLifecycle, type Disposable, type Experience } from './lifecycle.js';
import { resolveXRMode, type ExperienceMode, type ResolvedXRMode, type XRSupport } from './mode.js';

/**
 * Thin bootstrap around an IWSDK World (PRD §4.1). Everything native stays reachable
 * through `ctx.world`; this only adds lifecycle, VR/MR entry, theme and haptics.
 */
export type ExperienceContext = {
  world: World;
  theme: Theme;
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

  const ctx: ExperienceContext = {
    world,
    theme,
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

  class ExperienceSystem extends createSystem({}) {
    update(delta: number, time: number): void {
      lifecycle.tick(delta, time);
    }
  }
  world.registerSystem(ExperienceSystem);
  lifecycle.start();

  const dispose = () => {
    lifecycle.stop();
    disposables.disposeAll();
  };

  return { ctx, dispose };
};
