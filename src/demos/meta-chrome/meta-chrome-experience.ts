// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { DataTexture, LinearFilter, Mesh, RepeatWrapping, SRGBColorSpace, ShaderMaterial, Vector3, type UIKitMLAsset } from '@iwsdk/core';
import { createObjectGestures } from '../../components/interaction/object-gestures.js';
import { bindParamChoice } from '../../components/ui/controls-advanced.js';
import { bindButton, bindSlider, bindTabs, bindToggle, requireElement } from '../../components/ui/controls.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import { bindSharedConsole } from '../../components/ui/shared-console.js';
import { standardFeedback } from '../../components/ui/standard-sections.js';
import { bindUI, controlOptions, toggleOptions } from '../../core/parameters/bindings.js';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { bakePalette, PALETTE_SIZE } from '../../shaders/color/palettes.js';
import { loadWarmBallRoom } from '../../shaders/warm-ball-room.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { CHROME_QUALITY_STEPS, type MetaChromeUniforms } from './meta-chrome-material.js';
import { createChromePinch } from './chrome-pinch.js';

export const NODE_IDS = { chrome: 'meta-chrome', panel: 'chrome-panel' } as const;
export const CHROME_GLOW_COLORS = ['Original', 'Magenta', 'Cyan', 'Amber', 'White'] as const;
const GLOW_RGB: readonly (readonly [number, number, number])[] = [
  [0.192, 0.075, 0.788], [1, 0.072, 0.616], [0, 0.693, 0.572], [1, 0.301, 0], [1, 1, 1],
];
export const CHROME_PARAMS = {
  speed: { default: 0.5, min: 0, max: 1, smoothing: 0.2, label: 'Speed' },
  glowAmount: { default: 1, min: 0, max: 3, smoothing: 0.15, label: 'Glow amount' },
  glowColor: { default: 0, min: 0, max: 4, label: 'Glow color' },
  exposure: { default: 1, min: 0, max: 2, smoothing: 0.15, label: 'Exposure' },
  reflectionWarmth: { default: 0.5, min: 0, max: 1, smoothing: 0.15, label: 'Reflection warmth' },
  iridescent: { default: 0.5, min: 0, max: 1, smoothing: 0.15, label: 'Iridescent' },
  manipulateMode: { default: 0, type: 'boolean', label: 'Manipulate mode' },
  sphereSize: { default: 0.2, min: 0.05, max: 0.5, smoothing: 0.15, label: 'Sphere size' },
  showSpheres: { default: 0, type: 'boolean', label: 'Show spheres' },
  sminFactor: { default: 0.3, min: 0.02, max: 0.7, smoothing: 0.15, label: 'Smin blend' },
  quality: { default: 1, min: 0, max: 2, label: 'Quality' },
} satisfies Record<string, ParameterDefinition>;

export const createMetaChromeExperience = (): Experience<ExperienceContext> => {
  let frame: ((dt: number) => void) | undefined;
  return {
    init(ctx) {
      const { world, params, theme, track } = ctx;
      for (const [id, definition] of Object.entries(CHROME_PARAMS)) params.define(id, definition);
      const entity = world.requireSceneEntity(NODE_IDS.chrome);
      let uniforms: MetaChromeUniforms | undefined;
      entity.object3D!.traverse((child) => {
        if (child instanceof Mesh && child.material instanceof ShaderMaterial && child.material.name === 'meta-chrome') {
          uniforms = child.material.uniforms as unknown as MetaChromeUniforms;
        }
      });
      if (!uniforms) throw new Error('Meta Chrome material not found');
      const u = uniforms;
      const palette = track(new DataTexture(new Uint8Array(PALETTE_SIZE * 4), PALETTE_SIZE, 1));
      palette.colorSpace = SRGBColorSpace;
      palette.magFilter = LinearFilter;
      palette.minFilter = LinearFilter;
      palette.wrapS = RepeatWrapping;
      u.uPalette.value = palette;
      (palette.image.data as Uint8Array).set(bakePalette('Cosine Rainbow'));
      palette.needsUpdate = true;
      const setGlowColor = (index: number) => {
        const rgb = GLOW_RGB[Math.round(index)] ?? GLOW_RGB[0]!;
        u.uGlowColor.value.setRGB(rgb[0], rgb[1], rgb[2]);
      };
      track(params.subscribe('glowColor', setGlowColor));
      setGlowColor(params.getBase('glowColor'));
      u.uEnvironment.value = track(loadWarmBallRoom());

      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      const panelEntity = world.requireSceneEntity(NODE_IDS.panel);
      requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const common = { theme, onFeedback: standardFeedback(ctx) };
      const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2, inputs: false, summonOnShow: false }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
      track(bindTabs(panel, ['shape', 'glow', 'light'].map((n) => ({ tab: `tab-${n}`, page: `page-${n}` })), common));
      for (const id of ['speed', 'glowAmount', 'exposure', 'reflectionWarmth', 'iridescent', 'sphereSize', 'sminFactor'] as const) {
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step: 0.01 }));
        track(bindUI(params, id, control));
      }
      for (const id of ['manipulateMode', 'showSpheres'] as const) {
        const control = track(bindToggle(panel, id, { ...common, ...toggleOptions(params, id) }));
        track(bindUI(params, id, control));
      }
      const manipulateControls = requireElement(panel, 'manipulate-controls');
      const interactionHint = requireElement(panel, 'interaction-hint');
      const showMode = (value: number) => {
        const active = value >= 0.5;
        manipulateControls.setProperties({ display: active ? 'flex' : 'none' });
        interactionHint.setProperties({ text: active
          ? 'Manipulate: pinch with either hand to shape the liquid.'
          : 'Transform/Move: both hands zoom and rotate; right hand moves the object.' });
      };
      track(params.subscribe('manipulateMode', showMode));
      showMode(params.getBase('manipulateMode'));
      track(bindParamChoice(panel, 'glowColor', CHROME_GLOW_COLORS, { ...common, params, id: 'glowColor' }));
      track(bindParamChoice(panel, 'quality', ['Low', 'Medium', 'High'], { ...common, params, id: 'quality' }));
      bindSharedConsole(ctx, panel, common, menu);

      const gestures = createObjectGestures(ctx, entity, {
        disabled: () => params.get('manipulateMode') >= 0.5,
        ignore: [panelEntity],
      });
      const pinch = createChromePinch(world, entity.object3D!, u);
      let time = 0;
      frame = (dt) => {
        menu.update();
        gestures.update();
        pinch.update(params.get('manipulateMode') >= 0.5);
        time += dt * params.get('speed');
        u.uTime.value = time;
        u.uGlowAmount.value = params.get('glowAmount');
        u.uExposure.value = params.get('exposure');
        u.uReflectionWarmth.value = params.get('reflectionWarmth');
        u.uIridescence.value = params.get('iridescent');
        u.uSphereSize.value = params.get('sphereSize');
        u.uShowSpheres.value = params.get('showSpheres');
        u.uSminFactor.value = params.get('sminFactor');
        u.uSteps.value = CHROME_QUALITY_STEPS[Math.max(0, Math.min(2, Math.round(params.get('quality'))))]!;
      };
    },
    update(dt) { frame?.(dt); },
    dispose() { frame = undefined; },
  };
};
