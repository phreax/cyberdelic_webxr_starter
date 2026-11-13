import { Grabbed, Mesh, ShaderMaterial, SphereGeometry, type UIKitMLAsset } from '@iwsdk/core';
import type { AudioSignal } from '../../components/audio/audio-engine.js';
import { spectrumBars } from '../../components/audio/spectrum-bars.js';
import { makeManipulable } from '../../components/interaction/manipulable.js';
import { bindButton, bindKnob, bindSlider, bindTabs, bindToggle, requireElement, type UIElement } from '../../components/ui/controls.js';
import { bindParamChoice } from '../../components/ui/controls-advanced.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import { bindSharedConsole } from '../../components/ui/shared-console.js';
import { bindAudioSection, standardFeedback } from '../../components/ui/standard-sections.js';
import { bindAudio, bindUI, controlOptions, toggleOptions } from '../../core/parameters/bindings.js';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { createSculptureGeometry } from './reactive-sculpture.scene-asset.js';
import { loadWarmBallRoom } from '../../shaders/warm-ball-room.js';
import type { SculptureUniforms } from './sculpture-material.js';

/** Scene node ids authored in public/scenes/main.iwsdk.scene.json. */
export const NODE_IDS = { sculpture: 'reactive-sculpture', panel: 'control-panel' } as const;

/** Every sculpture parameter lives in the shared store, so UI, audio and OSC can drive it. */
export const SCULPTURE_PARAMS = {
  growth: { default: 0.45, min: 0, max: 1, smoothing: 0.25, label: 'Growth' },
  complexity: { default: 1.6, min: 0.5, max: 4, smoothing: 0.4, label: 'Complexity' },
  twist: { default: 0.8, min: -3, max: 3, smoothing: 0.4, label: 'Twist' },
  flow: { default: 0.4, min: 0, max: 2, smoothing: 0.3, label: 'Flow' },
  glow: { default: 0.35, min: 0, max: 1, smoothing: 0.15, label: 'Glow' },
  alpha: { default: 1, min: 0.1, max: 1, smoothing: 0.15, label: 'Alpha' },
  pulse: { default: 0, min: 0, max: 1, label: 'Beat pulse' },
  spin: { default: 1, type: 'boolean', label: 'Auto spin' },
  reactivity: { default: 0.6, min: 0, max: 1, smoothing: 0.1, label: 'Audio reactivity' },
  quality: { default: 0, min: 0, max: 2, label: 'Mesh quality' },
  finish: { default: 1, min: 0, max: 1, label: 'Material' },
  matcapBrightness: { default: 0.8, min: 0, max: 1.5, smoothing: 0.15, label: 'MatCap brightness' },
  reflectionWarmth: { default: 0.5, min: 0, max: 1, smoothing: 0.15, label: 'Reflection warmth' },
  iridescence: { default: 0.7, min: 0, max: 1, smoothing: 0.15, label: 'Iridescence' },
} satisfies Record<string, ParameterDefinition>;

const SPIN_SPEED = 0.15; // rad/s
const METER_INTERVAL = 1 / 15;

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
      let sculptureMesh: Mesh | undefined;
      object.traverse((child) => {
        if (child instanceof Mesh && child.material instanceof ShaderMaterial && child.material.name === 'reactive-sculpture') {
          sculptureMesh = child;
          uniforms = child.material.uniforms as unknown as SculptureUniforms;
        }
      });
      if (!uniforms || !sculptureMesh) throw new Error('Reactive sculpture material not found');
      const mesh = sculptureMesh as Mesh;
      const baseGeometry = mesh.geometry as SphereGeometry;
      const radius = baseGeometry.parameters.radius;
      const geometries: SphereGeometry[] = [baseGeometry];
      const setQuality = (value: number) => {
        const index = Math.max(0, Math.min(2, Math.round(value)));
        if (!geometries[index]) geometries[index] = track(createSculptureGeometry(radius, index));
        mesh.geometry = geometries[index]!;
      };
      track(params.subscribe('quality', setQuality));
      setQuality(params.getBase('quality'));
      uniforms.uEnvironment.value = track(loadWarmBallRoom());
      uniforms.uPrimary.value.set(theme.colors.primary);
      uniforms.uSecondary.value.set(theme.colors.secondary);
      uniforms.uDeep.value.set(theme.colors.background);
      makeManipulable(entity, { grab: 'near', scale: { min: 0.4, max: 3 } });
      const home = { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() };

      // --- Panel ------------------------------------------------------------------------
      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const common = { theme, onFeedback: standardFeedback(ctx) };
      const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2, inputs: false, summonOnShow: false }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
      const tabs = track(
        bindTabs(
          panel,
          ['shape', 'audio', 'material'].map((name) => ({ tab: `tab-${name}`, page: `page-${name}` })),
          common,
        ),
      );

      // Shape and material controls remain two-way bound to the parameter store.
      const sliders = { growth: 0.01, complexity: 0.05, flow: 0.05, glow: 0.01, alpha: 0.01 } as const;
      for (const [id, step] of Object.entries(sliders)) {
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step }));
        track(bindUI(params, id, control));
      }
      for (const id of ['twist'] as const) {
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

      track(bindParamChoice(panel, 'quality', ['Low', 'Medium', 'High'], { ...common, params, id: 'quality' }));
      track(bindParamChoice(panel, 'material', ['Chrome', 'Iridescent'], { ...common, params, id: 'finish' }));
      const matcapBrightnessControl = requireElement(panel, 'matcap-brightness-control');
      const iridescenceControl = requireElement(panel, 'iridescence-control');
      const showMaterialControls = (value: number) => {
        const material = Math.round(value);
        matcapBrightnessControl.setProperties({ display: material === 1 ? 'flex' : 'none' });
        iridescenceControl.setProperties({ display: material === 1 ? 'flex' : 'none' });
      };
      track(params.subscribe('finish', showMaterialControls));
      showMaterialControls(params.getBase('finish'));
      const matcapBrightness = track(bindSlider(panel, 'matcapBrightness', {
        ...common, ...controlOptions(params, 'matcapBrightness'), step: 0.01,
      }));
      track(bindUI(params, 'matcapBrightness', matcapBrightness));
      const iridescence = track(bindSlider(panel, 'iridescence', {
        ...common, ...controlOptions(params, 'iridescence'), step: 0.01,
      }));
      track(bindUI(params, 'iridescence', iridescence));
      const reflectionWarmth = track(bindSlider(panel, 'reflectionWarmth', {
        ...common, ...controlOptions(params, 'reflectionWarmth'), step: 0.01,
      }));
      track(bindUI(params, 'reflectionWarmth', reflectionWarmth));

      // Audio sources + widgets.
      bindAudioSection(ctx, panel, common);
      const reactivity = track(bindSlider(panel, 'reactivity', { ...common, ...controlOptions(params, 'reactivity'), step: 0.05 }));
      track(bindUI(params, 'reactivity', reactivity));
      const meters = (['volume', 'bass', 'mid', 'high'] as const).map((signal) => ({ signal, element: requireElement(panel, `meter-${signal}`) }));
      const bars: UIElement[] = Array.from({ length: 16 }, (_, i) => requireElement(panel, `spec-${i}`));
      const barValues = new Array<number>(bars.length).fill(0);
      if (audio) {
        track(
          audio.onState((state) => {
            if (state.status === 'active') return;
            meters.forEach(({ element }) => element.setProperties({ width: '0%' }));
            bars.forEach((bar) => bar.setProperties({ height: 2 }));
          }),
        );
      }

      // Session: VR/MR entry, status, haptics toggle, FPS.
      bindSharedConsole(ctx, panel, common, menu);

      // --- Per-frame ----------------------------------------------------------------------
      let meterClock = 0;
      const u = uniforms;

      frame = (dt) => {
        menu.update();

        // Parameters → shader uniforms (store already applied audio modulation + smoothing).
        u.uPhase.value += dt * params.get('flow');
        u.uGrowth.value = params.get('growth');
        u.uComplexity.value = params.get('complexity');
        u.uTwist.value = params.get('twist');
        u.uGlow.value = params.get('glow');
        u.uPulse.value = params.get('pulse');
        u.uAlpha.value = params.get('alpha');
        u.uMaterial.value = params.get('finish');
        u.uMatcapBrightness.value = params.get('matcapBrightness');
        u.uReflectionWarmth.value = params.get('reflectionWarmth');
        u.uIridescence.value = params.get('iridescence');
        if (params.get('spin') >= 0.5 && !entity.hasComponent(Grabbed)) object.rotateY(dt * SPIN_SPEED);

        // Widgets, throttled: only while the Audio tab is open and a source is active.
        meterClock += dt;
        if (audio && audio.state.status === 'active' && tabs.value === 1 && menu.visible && meterClock >= METER_INTERVAL) {
          meterClock = 0;
          for (const { signal, element } of meters) element.setProperties({ width: `${Math.round(audio.get(signal) * 100)}%` });
          spectrumBars(audio.getSpectrum(), bars.length, barValues);
          bars.forEach((bar, i) => bar.setProperties({ height: 2 + Math.round(barValues[i]! * 44) }));
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
