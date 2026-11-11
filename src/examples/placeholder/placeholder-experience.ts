import { Mesh, ShaderMaterial, VisibilityState, type UIKitMLAsset } from '@iwsdk/core';
import { createGrabHapticsSystem, makeManipulable } from '../../components/interaction/manipulable.js';
import { createPanelMenu, type PanelMenu } from '../../components/ui/panel-menu.js';
import { bindButton, bindKnob, bindSlider, bindTabs, bindToggle, requireElement, type Feedback } from '../../components/ui/controls.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import type { OrbUniforms } from './orb-material.js';

/** Scene node ids authored in public/scenes/main.iwsdk.scene.json. */
export const NODE_IDS = { orb: 'cyber-orb', panel: 'control-panel' } as const;

const DEFAULTS = { speed: 1, displace: 0.06, hue: 0, pulse: false } as const;

/**
 * Phase 1/2 placeholder: a grabbable, scalable noise orb driven by a themed control panel.
 * Shows the lifecycle (init/update/dispose), VR/MR entry, spatial controls and haptics.
 */
export const createPlaceholderExperience = (): Experience<ExperienceContext> => {
  let uniforms: OrbUniforms | undefined;
  let speed: number = DEFAULTS.speed;
  let menu: PanelMenu | undefined;

  return {
    init(ctx) {
      const { world, haptics, theme, track } = ctx;

      // Orb: grab near/far, rotate, two-hand scale; haptics on grab/release.
      const orbEntity = world.requireSceneEntity(NODE_IDS.orb);
      orbEntity.object3D?.traverse((child) => {
        if (child instanceof Mesh && child.material instanceof ShaderMaterial && child.name === 'cyber-orb-core') {
          uniforms = child.material.uniforms as unknown as OrbUniforms;
        }
      });
      makeManipulable(orbEntity, { scale: { min: 0.4, max: 3 } });
      world.registerSystem(createGrabHapticsSystem(haptics));
      const home = orbEntity.object3D
        ? { position: orbEntity.object3D.position.clone(), quaternion: orbEntity.object3D.quaternion.clone(), scale: orbEntity.object3D.scale.clone() }
        : undefined;

      // Panel
      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      const root = requireElement(panel, 'panel');
      root.setProperties(panelStyle(theme));
      const status = requireElement(panel, 'status');
      const xrInfo = requireElement(panel, 'xr-info');

      const feedback = (kind: Feedback) => {
        if (kind === 'press') haptics.playActive('click');
        else if (kind === 'change') haptics.playActive('select');
      };
      const common = { theme, onFeedback: feedback };

      // Menu: grab bar to move, hide with the Hide button / left Menu button / wrist button / M.
      menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2 }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu?.hide() }));

      const speedSlider = track(
        bindSlider(panel, 'speed', { ...common, min: 0, max: 3, step: 0.05, value: DEFAULTS.speed, onChange: (v) => (speed = v) }),
      );
      const displaceSlider = track(
        bindSlider(panel, 'displace', {
          ...common,
          min: 0,
          max: 0.3,
          step: 0.01,
          value: DEFAULTS.displace,
          onChange: (v) => uniforms && (uniforms.uDisplace.value = v),
        }),
      );
      const hueKnob = track(
        bindKnob(panel, 'hue', {
          ...common,
          min: 0,
          max: 1,
          step: 0.01,
          value: DEFAULTS.hue,
          sensitivity: 1,
          onChange: (v) => uniforms && (uniforms.uHue.value = v),
        }),
      );
      const pulseToggle = track(
        bindToggle(panel, 'pulse', { ...common, value: DEFAULTS.pulse, onChange: (v) => uniforms && (uniforms.uPulse.value = v ? 1 : 0) }),
      );
      track(
        bindButton(panel, 'btn-reset', {
          ...common,
          onClick: () => {
            speed = DEFAULTS.speed;
            speedSlider.setValue(DEFAULTS.speed);
            displaceSlider.setValue(DEFAULTS.displace);
            hueKnob.setValue(DEFAULTS.hue);
            pulseToggle.setValue(DEFAULTS.pulse);
            if (uniforms) {
              uniforms.uDisplace.value = DEFAULTS.displace;
              uniforms.uHue.value = DEFAULTS.hue;
              uniforms.uPulse.value = 0;
            }
            if (home && orbEntity.object3D) {
              orbEntity.object3D.position.copy(home.position);
              orbEntity.object3D.quaternion.copy(home.quaternion);
              orbEntity.object3D.scale.copy(home.scale);
            }
          },
        }),
      );
      track(bindTabs(panel, [{ tab: 'tab-visual', page: 'page-visual' }, { tab: 'tab-session', page: 'page-session' }], common));

      // Session controls
      const { support } = ctx.xr;
      const vrButton = track(bindButton(panel, 'btn-vr', { ...common, disabled: !support.vr && !support.ar, onClick: () => report(ctx.xr.enter('vr')) }));
      const mrButton = track(bindButton(panel, 'btn-mr', { ...common, disabled: !support.vr && !support.ar, onClick: () => report(ctx.xr.enter('mixed-reality')) }));
      const exitButton = track(bindButton(panel, 'btn-exit', { ...common, disabled: true, onClick: () => ctx.xr.exit() }));
      track(bindToggle(panel, 'haptics', { ...common, value: true, onChange: (v) => haptics.setEnabled(v) }));

      const report = (resolved: ReturnType<ExperienceContext['xr']['enter']>) => {
        const text = resolved.mode === null ? resolved.reason : (resolved.fallbackReason ?? `Starting ${resolved.mode === 'vr' ? 'VR' : 'mixed reality'}...`);
        xrInfo.setProperties({ text });
      };
      xrInfo.setProperties({
        text: `VR ${support.vr ? 'available' : 'unavailable'} | MR ${support.ar ? 'available' : 'unavailable'}`,
      });

      track(
        world.visibilityState.subscribe((state) => {
          const immersive = state !== VisibilityState.NonImmersive;
          const blend = world.session?.environmentBlendMode;
          status.setProperties({
            text: !immersive ? 'Desktop preview' : blend && blend !== 'opaque' ? 'Mixed reality' : 'Virtual reality',
          });
          vrButton.setDisabled(immersive || (!support.vr && !support.ar));
          mrButton.setDisabled(immersive || (!support.vr && !support.ar));
          exitButton.setDisabled(!immersive);
        }),
      );
    },

    update(dt) {
      menu?.update();
      if (uniforms) uniforms.uTime.value += dt * speed;
    },

    dispose() {
      uniforms = undefined;
      menu = undefined;
    },
  };
};
