import { VisibilityState } from '@iwsdk/core';
import type { AudioState } from '../audio/audio-engine.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { createFpsMeter } from '../../utils/fps-meter.js';
import { bindButton, bindStatus, bindToggle, type BindOptions, type ElementSource, type StatusLevel, type UIElement } from './controls.js';

/**
 * Reusable panel sections shared by the examples. Optional elements are skipped when absent.
 * Audio: btn-mic, btn-capture, btn-demo, [btn-file], btn-stop, audio-dot, audio-status.
 * Session: btn-vr, btn-mr, btn-exit, mode-dot, status, [xr-info], [haptics], [fps-dot, fps].
 */
const has = (source: ElementSource, id: string) => source.getElementById(id) != null;

const AUDIO_LEVEL: Record<AudioState['status'], StatusLevel> = {
  idle: 'idle',
  requesting: 'warn',
  active: 'ok',
  denied: 'error',
  unsupported: 'warn',
  error: 'error',
};

export const bindAudioSection = (ctx: ExperienceContext, panel: ElementSource, common: BindOptions) => {
  const { audio, theme, track, world } = ctx;
  const setStatus = bindStatus(panel, { dot: 'audio-dot', text: 'audio-status' }, theme);
  const button = (id: string, disabled: boolean, onClick: () => void) =>
    has(panel, id) ? track(bindButton(panel, id, { ...common, disabled, onClick })) : undefined;
  const buttons = {
    microphone: button('btn-mic', !audio?.supports.microphone, () => void audio?.useMicrophone()),
    playback: button('btn-capture', !audio?.supports.playbackCapture, () => void audio?.usePlaybackCapture()),
    demo: button('btn-demo', !audio, () => void audio?.useDemo()),
    file: button('btn-file', !audio, () => audio?.pickFile()),
  };
  const stop = button('btn-stop', true, () => audio?.stop());
  if (!audio) {
    setStatus('idle', 'Audio disabled in createExperience config');
    return;
  }
  const show = (state: AudioState) => {
    setStatus(AUDIO_LEVEL[state.status], state.message);
    stop?.setDisabled(state.status !== 'active');
    for (const [source, control] of Object.entries(buttons)) control?.setSelected(state.status === 'active' && state.source === source);
  };
  track(audio.onState(show));
  show(audio.state);
  // No file picker inside an immersive session.
  if (buttons.file) {
    const file = buttons.file;
    track(world.visibilityState.subscribe((state) => file.setDisabled(state !== VisibilityState.NonImmersive)));
  }
};

export const bindSessionSection = (ctx: ExperienceContext, panel: ElementSource, common: BindOptions) => {
  const { world, theme, track, haptics } = ctx;
  bindExampleSwitcher(ctx, panel, common);
  const { support } = ctx.xr;
  const noXR = !support.vr && !support.ar;
  const xrInfo = has(panel, 'xr-info') ? (panel.getElementById('xr-info') as UIElement) : undefined;
  const setMode = bindStatus(panel, { dot: 'mode-dot', text: 'status' }, theme);
  const report = (resolved: ReturnType<ExperienceContext['xr']['enter']>) =>
    xrInfo?.setProperties({
      text: resolved.mode === null ? resolved.reason : (resolved.fallbackReason ?? `Starting ${resolved.mode === 'vr' ? 'VR' : 'mixed reality'}...`),
    });
  const vr = track(bindButton(panel, 'btn-vr', { ...common, disabled: noXR, onClick: () => report(ctx.xr.enter('vr')) }));
  const mr = track(bindButton(panel, 'btn-mr', { ...common, disabled: noXR, onClick: () => report(ctx.xr.enter('mixed-reality')) }));
  const exit = track(bindButton(panel, 'btn-exit', { ...common, disabled: true, onClick: () => ctx.xr.exit() }));
  if (has(panel, 'haptics')) track(bindToggle(panel, 'haptics', { ...common, value: true, onChange: (v) => haptics.setEnabled(v) }));
  xrInfo?.setProperties({ text: `VR ${support.vr ? 'available' : 'unavailable'} | MR ${support.ar ? 'available' : 'unavailable'}` });
  track(
    world.visibilityState.subscribe((state) => {
      const immersive = state !== VisibilityState.NonImmersive;
      const blend = world.session?.environmentBlendMode;
      setMode(immersive ? 'ok' : 'idle', !immersive ? 'Desktop preview' : blend && blend !== 'opaque' ? 'Mixed reality' : 'Virtual reality');
      vr.setDisabled(immersive || noXR);
      mr.setDisabled(immersive || noXR);
      exit.setDisabled(!immersive);
    }),
  );

  if (has(panel, 'fps') && has(panel, 'fps-dot')) {
    const setFps = bindStatus(panel, { dot: 'fps-dot', text: 'fps' }, theme);
    const meter = createFpsMeter();
    let clock = 0;
    ctx.onFrame((dt) => {
      meter.push(dt);
      clock += dt;
      if (clock < 0.5) return;
      clock = 0;
      const value = meter.fps();
      setFps(value >= 70 ? 'ok' : value >= 55 ? 'warn' : 'error', `${Math.round(value)} fps`);
    });
  }
};

/**
 * "Demos" row: one button per example (`example-<id>`), current one selected. Switching happens
 * after the click finishes, so the panel isn't torn down mid-event.
 */
export const bindExampleSwitcher = (ctx: ExperienceContext, panel: ElementSource, common: BindOptions) => {
  const { examples, track } = ctx;
  if (!examples) return;
  for (const { id } of examples.list) {
    if (!has(panel, `example-${id}`)) continue;
    track(
      bindButton(panel, `example-${id}`, {
        ...common,
        selected: id === examples.current,
        onClick: () => {
          if (id !== examples.current) setTimeout(() => examples.switchTo(id), 0);
        },
      }),
    );
  }
};

/** Haptic + sound feedback used by every example's controls. */
export const standardFeedback = (ctx: ExperienceContext) => (kind: 'hover' | 'press' | 'change') => {
  if (kind === 'press') {
    ctx.haptics.playActive('click');
    ctx.sounds.play('click');
  } else if (kind === 'change') {
    ctx.haptics.playActive('select');
    ctx.sounds.play('select');
  }
};
