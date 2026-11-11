import { Grabbed, Mesh, ShaderMaterial, VisibilityState, type UIKitMLAsset } from '@iwsdk/core';
import type { AudioSignal, AudioState } from '../../components/audio/audio-engine.js';
import { spectrumBars } from '../../components/audio/spectrum-bars.js';
import { createGrabHapticsSystem, makeManipulable } from '../../components/interaction/manipulable.js';
import {
  bindButton,
  bindKnob,
  bindSlider,
  bindStatus,
  bindTabs,
  bindToggle,
  requireElement,
  type Feedback,
  type StatusLevel,
  type UIElement,
} from '../../components/ui/controls.js';
import { bindPresetSelector } from '../../components/ui/controls-advanced.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import { bindAudio, bindUI, controlOptions, toggleOptions } from '../../core/parameters/bindings.js';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { createFpsMeter } from '../../utils/fps-meter.js';
import { SCULPTURE_PRESETS } from './presets.js';
import type { SculptureUniforms } from './sculpture-material.js';

/** Scene node ids authored in public/scenes/main.iwsdk.scene.json. */
export const NODE_IDS = { sculpture: 'reactive-sculpture', panel: 'control-panel' } as const;

/** Every sculpture parameter lives in the shared store, so UI, audio, presets and OSC can drive it. */
export const SCULPTURE_PARAMS = {
  growth: { default: 0.45, min: 0, max: 1, smoothing: 0.25, label: 'Growth' },
  complexity: { default: 1.6, min: 0.5, max: 4, smoothing: 0.4, label: 'Complexity' },
  twist: { default: 0.8, min: -3, max: 3, smoothing: 0.4, label: 'Twist' },
  flow: { default: 0.4, min: 0, max: 2, smoothing: 0.3, label: 'Flow' },
  hue: { default: 0, min: 0, max: 1, smoothing: 0.4, label: 'Hue' },
  glow: { default: 0.35, min: 0, max: 1, smoothing: 0.15, label: 'Glow' },
  alpha: { default: 1, min: 0.1, max: 1, smoothing: 0.15, label: 'Alpha' },
  pulse: { default: 0, min: 0, max: 1, label: 'Beat pulse' },
  spin: { default: 1, type: 'boolean', label: 'Auto spin' },
  reactivity: { default: 0.6, min: 0, max: 1, smoothing: 0.1, label: 'Audio reactivity' },
} satisfies Record<string, ParameterDefinition>;

const SPIN_SPEED = 0.15; // rad/s
const METER_INTERVAL = 1 / 15;
const FPS_INTERVAL = 0.5;

export const createReactiveSculptureExperience = (): Experience<ExperienceContext> => {
  let frame: ((dt: number) => void) | undefined;

  return {
    init(ctx) {
      const { world, params, audio, haptics, theme, track } = ctx;

      // --- Parameters -------------------------------------------------------------------
      for (const [id, definition] of Object.entries(SCULPTURE_PARAMS)) params.define(id, definition);

      // Audio → parameters, scaled by the Reactivity control (0 = no audio influence at all).
      if (audio) {
        const scaled = (signal: AudioSignal) => () => audio.get(signal) * params.get('reactivity');
        track(params.modulate('growth', { read: scaled('bass'), mode: 'add', amount: 0.5 }));
        track(params.modulate('flow', { read: scaled('mid'), mode: 'add', amount: 0.25 }));
        track(params.modulate('glow', { read: scaled('high'), mode: 'add', amount: 0.6 }));
        track(bindAudio(params, { get: (s) => (params.get('reactivity') > 0 ? audio.get(s) : 0) }, 'beat', 'pulse', { mode: 'trigger', amount: 1, decay: 0.3 }));
      }

      // --- Sculpture --------------------------------------------------------------------
      const entity = world.requireSceneEntity(NODE_IDS.sculpture);
      const object = entity.object3D!;
      let uniforms: SculptureUniforms | undefined;
      let material: ShaderMaterial | undefined;
      object.traverse((child) => {
        if (child instanceof Mesh && child.material instanceof ShaderMaterial && child.material.name === 'reactive-sculpture') {
          material = child.material;
          uniforms = child.material.uniforms as unknown as SculptureUniforms;
        }
      });
      if (!uniforms || !material) throw new Error('Reactive sculpture material not found');
      const sculptureMaterial = material;
      uniforms.uPrimary.value.set(theme.colors.primary);
      uniforms.uSecondary.value.set(theme.colors.secondary);
      uniforms.uDeep.value.set(theme.colors.background);
      makeManipulable(entity, { grab: 'near', scale: { min: 0.4, max: 3 } });
      world.registerSystem(createGrabHapticsSystem(haptics));
      const home = { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() };

      // --- Panel ------------------------------------------------------------------------
      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const feedback = (kind: Feedback) => {
        if (kind === 'press') haptics.playActive('click');
        else if (kind === 'change') haptics.playActive('select');
      };
      const common = { theme, onFeedback: feedback };
      const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2 }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
      const tabs = track(
        bindTabs(
          panel,
          ['shape', 'audio', 'presets', 'session'].map((name) => ({ tab: `tab-${name}`, page: `page-${name}` })),
          common,
        ),
      );

      // Shape: two-way bound to the store, so presets / OSC move the controls too.
      const sliders = { growth: 0.01, complexity: 0.05, flow: 0.05, glow: 0.01, alpha: 0.01 } as const;
      for (const [id, step] of Object.entries(sliders)) {
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step }));
        track(bindUI(params, id, control));
      }
      for (const id of ['twist', 'hue'] as const) {
        const control = track(bindKnob(panel, id, { ...common, ...controlOptions(params, id), step: 0.01, sensitivity: 1 }));
        track(bindUI(params, id, control));
      }
      const spin = track(bindToggle(panel, 'spin', { ...common, ...toggleOptions(params, 'spin') }));
      track(bindUI(params, 'spin', spin));
      track(
        bindButton(panel, 'btn-reset', {
          ...common,
          onClick: () => {
            for (const id of Object.keys(SCULPTURE_PARAMS)) if (id !== 'reactivity') params.reset(id, 'code');
            object.position.copy(home.position);
            object.quaternion.copy(home.quaternion);
            object.scale.copy(home.scale);
          },
        }),
      );

      // Presets: shared PresetSelector, selected state follows the live values.
      track(bindPresetSelector(panel, 'preset', { ...common, params, presets: SCULPTURE_PRESETS }));

      // Audio sources + widgets.
      const setAudioStatus = bindStatus(panel, { dot: 'audio-dot', text: 'audio-status' }, theme);
      const reactivity = track(bindSlider(panel, 'reactivity', { ...common, ...controlOptions(params, 'reactivity'), step: 0.05 }));
      track(bindUI(params, 'reactivity', reactivity));
      const meters = (['volume', 'bass', 'mid', 'high'] as const).map((signal) => ({ signal, element: requireElement(panel, `meter-${signal}`) }));
      const bars: UIElement[] = Array.from({ length: 16 }, (_, i) => requireElement(panel, `spec-${i}`));
      const barValues = new Array<number>(bars.length).fill(0);
      const audioButtons = {
        mic: track(bindButton(panel, 'btn-mic', { ...common, disabled: !audio?.supports.microphone, onClick: () => void audio?.useMicrophone() })),
        capture: track(bindButton(panel, 'btn-capture', { ...common, disabled: !audio?.supports.playbackCapture, onClick: () => void audio?.usePlaybackCapture() })),
        demo: track(bindButton(panel, 'btn-demo', { ...common, disabled: !audio, onClick: () => void audio?.useDemo() })),
        file: track(bindButton(panel, 'btn-file', { ...common, disabled: !audio, onClick: () => audio?.pickFile() })),
        stop: track(bindButton(panel, 'btn-stop', { ...common, disabled: true, onClick: () => audio?.stop() })),
      };
      const audioLevel: Record<AudioState['status'], StatusLevel> = { idle: 'idle', requesting: 'warn', active: 'ok', denied: 'error', unsupported: 'warn', error: 'error' };
      const showAudioState = (state: AudioState) => {
        setAudioStatus(audioLevel[state.status], state.message);
        audioButtons.stop.setDisabled(state.status !== 'active');
        audioButtons.mic.setSelected(state.status === 'active' && state.source === 'microphone');
        audioButtons.capture.setSelected(state.status === 'active' && state.source === 'playback');
        audioButtons.demo.setSelected(state.status === 'active' && state.source === 'demo');
        audioButtons.file.setSelected(state.status === 'active' && state.source === 'file');
        if (state.status !== 'active') {
          meters.forEach(({ element }) => element.setProperties({ width: '0%' }));
          bars.forEach((bar) => bar.setProperties({ height: 2 }));
        }
      };
      if (audio) {
        track(audio.onState(showAudioState));
        showAudioState(audio.state);
      } else setAudioStatus('idle', 'Audio disabled in createExperience config');

      // Session.
      const { support } = ctx.xr;
      const xrInfo = requireElement(panel, 'xr-info');
      const setMode = bindStatus(panel, { dot: 'mode-dot', text: 'status' }, theme);
      const setFps = bindStatus(panel, { dot: 'fps-dot', text: 'fps' }, theme);
      const noXR = !support.vr && !support.ar;
      const report = (resolved: ReturnType<ExperienceContext['xr']['enter']>) =>
        xrInfo.setProperties({
          text: resolved.mode === null ? resolved.reason : (resolved.fallbackReason ?? `Starting ${resolved.mode === 'vr' ? 'VR' : 'mixed reality'}...`),
        });
      const vr = track(bindButton(panel, 'btn-vr', { ...common, disabled: noXR, onClick: () => report(ctx.xr.enter('vr')) }));
      const mr = track(bindButton(panel, 'btn-mr', { ...common, disabled: noXR, onClick: () => report(ctx.xr.enter('mixed-reality')) }));
      const exit = track(bindButton(panel, 'btn-exit', { ...common, disabled: true, onClick: () => ctx.xr.exit() }));
      track(bindToggle(panel, 'haptics', { ...common, value: true, onChange: (v) => haptics.setEnabled(v) }));
      xrInfo.setProperties({ text: `VR ${support.vr ? 'available' : 'unavailable'} | MR ${support.ar ? 'available' : 'unavailable'}` });
      track(
        world.visibilityState.subscribe((state) => {
          const immersive = state !== VisibilityState.NonImmersive;
          const blend = world.session?.environmentBlendMode;
          setMode(immersive ? 'ok' : 'idle', !immersive ? 'Desktop preview' : blend && blend !== 'opaque' ? 'Mixed reality' : 'Virtual reality');
          vr.setDisabled(immersive || noXR);
          mr.setDisabled(immersive || noXR);
          exit.setDisabled(!immersive);
          // No file picker inside an immersive session.
          audioButtons.file.setDisabled(immersive || !audio);
        }),
      );

      // --- Per-frame ----------------------------------------------------------------------
      const fps = createFpsMeter();
      let meterClock = 0;
      let fpsClock = 0;
      const u = uniforms;

      frame = (dt) => {
        menu.update();

        // Parameters → shader uniforms (store already applied audio modulation + smoothing).
        u.uPhase.value += dt * params.get('flow');
        u.uGrowth.value = params.get('growth');
        u.uComplexity.value = params.get('complexity');
        u.uTwist.value = params.get('twist');
        u.uHue.value = params.get('hue');
        u.uGlow.value = params.get('glow');
        u.uPulse.value = params.get('pulse');
        u.uAlpha.value = params.get('alpha');
        // Opaque path at full alpha (depth-correct, no blending cost); translucent below it.
        const translucent = u.uAlpha.value < 0.999;
        if (sculptureMaterial.transparent !== translucent) {
          sculptureMaterial.transparent = translucent;
          sculptureMaterial.depthWrite = !translucent;
          sculptureMaterial.needsUpdate = true;
        }
        if (params.get('spin') >= 0.5 && !entity.hasComponent(Grabbed)) object.rotateY(dt * SPIN_SPEED);

        // Widgets, throttled: only while the Audio tab is open and a source is active.
        meterClock += dt;
        if (audio && audio.state.status === 'active' && tabs.value === 1 && menu.visible && meterClock >= METER_INTERVAL) {
          meterClock = 0;
          for (const { signal, element } of meters) element.setProperties({ width: `${Math.round(audio.get(signal) * 100)}%` });
          spectrumBars(audio.getSpectrum(), bars.length, barValues);
          bars.forEach((bar, i) => bar.setProperties({ height: 2 + Math.round(barValues[i]! * 44) }));
        }

        fps.push(dt);
        fpsClock += dt;
        if (fpsClock >= FPS_INTERVAL) {
          fpsClock = 0;
          const value = fps.fps();
          setFps(value >= 70 ? 'ok' : value >= 55 ? 'warn' : 'error', `${Math.round(value)} fps`);
        }
      };
    },

    update(dt) {
      frame?.(dt);
    },

    dispose() {
      frame = undefined;
    },
  };
};
