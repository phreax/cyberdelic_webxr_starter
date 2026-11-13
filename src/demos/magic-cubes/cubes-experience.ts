// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { DataTexture, LinearFilter, Mesh, RepeatWrapping, SRGBColorSpace, ShaderMaterial, type UIKitMLAsset } from '@iwsdk/core';
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
import { bakePalette, PALETTE_SIZE, type PaletteName } from '../../shaders/color/palettes.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { CUBES_QUALITY_STEPS, type CubesUniforms } from './cubes-material.js';

export const NODE_IDS = { cubes: 'magic-cubes', panel: 'cubes-panel' } as const;
export const CUBE_PALETTES: readonly PaletteName[] = [
  'Vibrant Coral', 'Neon', 'Cyberdelic', 'Ethereal Garden', 'Ocean Sunset', 'Cosine Rainbow', 'SciFi Machine', 'B&W',
];

/** shader-lab Magic Cubes parameters (audio reactivity, media and camera removed). */
export const CUBES_PARAMS = {
  speed: { default: 0.5, min: 0, max: 1, smoothing: 0.2, label: 'Speed' },
  kaleidoscope: { default: 0, type: 'boolean', label: 'Kaleidoscope' },
  mode: { default: 2, min: 0, max: 2, label: 'Mode' },
  colorMode: { default: 0, min: 0, max: 2, label: 'Color mode' },
  colorOffset: { default: 0, min: 0, max: 1, smoothing: 0.15, label: 'Color offset' },
  glow: { default: 0, type: 'boolean', label: 'Glow' },
  palette: { default: CUBE_PALETTES.indexOf('Ethereal Garden'), min: 0, max: CUBE_PALETTES.length - 1, label: 'Palette' },
  quality: { default: 1, min: 0, max: 2, label: 'Quality' },
} satisfies Record<string, ParameterDefinition>;

/**
 * Magic Cubes — shader-lab "Magic Cubes" (phreax) raymarched in a sphere. Both hands zoom + rotate,
 * the right hand moves + rotates, the left hand drags Color offset (wrapping).
 */
export const createMagicCubesExperience = (): Experience<ExperienceContext> => {
  let frame: ((dt: number) => void) | undefined;
  return {
    init(ctx) {
      const { world, params, theme, track } = ctx;
      for (const [id, definition] of Object.entries(CUBES_PARAMS)) params.define(id, definition);

      const entity = world.requireSceneEntity(NODE_IDS.cubes);
      let uniforms: CubesUniforms | undefined;
      entity.object3D!.traverse((child) => {
        if (child instanceof Mesh && child.material instanceof ShaderMaterial && child.material.name === 'magic-cubes') {
          uniforms = child.material.uniforms as unknown as CubesUniforms;
        }
      });
      if (!uniforms) throw new Error('Magic cubes material not found');
      const u = uniforms;

      const palette = track(new DataTexture(new Uint8Array(PALETTE_SIZE * 4), PALETTE_SIZE, 1));
      palette.colorSpace = SRGBColorSpace;
      palette.magFilter = LinearFilter;
      palette.minFilter = LinearFilter;
      palette.wrapS = RepeatWrapping;
      u.uPalette.value = palette;
      const setPalette = (index: number) => {
        (palette.image.data as Uint8Array).set(bakePalette(CUBE_PALETTES[Math.round(index)] ?? 'Ethereal Garden'));
        palette.needsUpdate = true;
      };
      track(params.subscribe('palette', setPalette));
      setPalette(params.getBase('palette'));

      // Panel
      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      const panelEntity = world.requireSceneEntity(NODE_IDS.panel);
      requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const common = { theme, onFeedback: standardFeedback(ctx) };
      const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2, inputs: false, summonOnShow: false }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
      track(bindTabs(panel, ['shape', 'color'].map((n) => ({ tab: `tab-${n}`, page: `page-${n}` })), common));
      for (const [id, step] of Object.entries({ speed: 0.01, colorOffset: 0.01 })) {
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step }));
        track(bindUI(params, id, control));
      }
      for (const id of ['kaleidoscope', 'glow'] as const) {
        const control = track(bindToggle(panel, id, { ...common, ...toggleOptions(params, id) }));
        track(bindUI(params, id, control));
      }
      track(bindParamChoice(panel, 'mode', ['Cube', 'Rings', 'Both'], { ...common, params, id: 'mode' }));
      track(bindParamChoice(panel, 'colorMode', ['Dual', 'Gradient', 'Alternate'], { ...common, params, id: 'colorMode' }));
      track(bindParamChoice(panel, 'palette', CUBE_PALETTES, { ...common, params, id: 'palette' }));
      track(bindParamChoice(panel, 'quality', ['Low', 'Medium', 'High'], { ...common, params, id: 'quality' }));
      bindSharedConsole(ctx, panel, common, menu);

      const gestures = createObjectGestures(ctx, entity, {
        // Colour offset wraps around, so dragging keeps cycling through the palette.
        onParameterDrag: (change) => {
          const next = params.getBase('colorOffset') + change;
          params.set('colorOffset', next - Math.floor(next), 'gesture');
        },
        ignore: [panelEntity],
      });

      let time = 0;
      frame = (dt) => {
        menu.update();
        gestures.update();
        time += dt * params.get('speed');
        u.uTime.value = time;
        u.uKaleidoscope.value = params.get('kaleidoscope');
        u.uMode.value = Math.round(params.get('mode'));
        u.uColorMode.value = Math.round(params.get('colorMode'));
        u.uColorOffset.value = params.get('colorOffset');
        u.uGlow.value = params.get('glow');
        u.uSteps.value = CUBES_QUALITY_STEPS[Math.max(0, Math.min(2, Math.round(params.get('quality'))))]!;
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
