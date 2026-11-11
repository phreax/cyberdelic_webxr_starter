import { Color, Mesh, MeshStandardMaterial, Points, ShaderMaterial, Vector3, type UIKitMLAsset } from '@iwsdk/core';
import type { AudioSignal } from '../../components/audio/audio-engine.js';
import { createProximityTrigger } from '../../components/interaction/behaviors.js';
import { bindButton, bindSlider, bindTabs, requireElement } from '../../components/ui/controls.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import { bindAudioSection, bindSessionSection, standardFeedback } from '../../components/ui/standard-sections.js';
import { bindUI, controlOptions } from '../../core/parameters/bindings.js';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { GARDEN_MAX_PARTICLES } from '../../scene-assets/particle-garden.scene-asset.js';
import { GARDEN_MOODS, type GardenMood } from './garden-math.js';
import type { GardenUniforms } from './particle-material.js';

export const NODE_IDS = { field: 'particle-garden', panel: 'garden-panel' } as const;
const ZONES: Record<GardenMood, string> = { Lagoon: 'zone-lagoon', Ember: 'zone-ember', Aurora: 'zone-aurora' };

export const GARDEN_PARAMS = {
  density: { default: 16000, min: 2000, max: GARDEN_MAX_PARTICLES, label: 'Density' },
  turbulence: { default: 0.12, min: 0, max: 0.4, smoothing: 0.25, label: 'Turbulence' },
  speed: { default: 1, min: 0, max: 3, smoothing: 0.3, label: 'Flow speed' },
  radius: { default: 0.3, min: 0.1, max: 0.6, smoothing: 0.1, label: 'Hand radius' },
  size: { default: 1, min: 0.4, max: 2.5, smoothing: 0.1, label: 'Particle size' },
  sparkle: { default: 0, min: 0, max: 1, label: 'Sparkle' },
  burst: { default: 0, min: 0, max: 1, label: 'Beat burst' },
  reactivity: { default: 0.7, min: 0, max: 1, smoothing: 0.1, label: 'Audio reactivity' },
} satisfies Record<string, ParameterDefinition>;

const MOOD_FADE_SECONDS = 1.2;

/**
 * Example 2 — Particle Garden. Open hand repels, pinch / trigger attracts; touching a ring
 * switches the mood; bass, high and beat drive turbulence, sparkle and bursts.
 */
export const createParticleGardenExperience = (): Experience<ExperienceContext> => {
  let frame: ((dt: number) => void) | undefined;

  return {
    init(ctx) {
      const { world, params, audio, theme, haptics, sounds, track } = ctx;
      for (const [id, definition] of Object.entries(GARDEN_PARAMS)) params.define(id, definition);

      if (audio) {
        const scaled = (signal: AudioSignal) => () => audio.get(signal) * params.get('reactivity');
        track(params.modulate('turbulence', { read: scaled('bass'), mode: 'add', amount: 0.5 }));
        track(params.modulate('sparkle', { read: scaled('high'), mode: 'add', amount: 1 }));
        track(params.modulate('burst', { read: () => (params.get('reactivity') > 0 ? audio.get('beat') : 0), mode: 'trigger', amount: 1, decay: 0.35 }));
      }

      // Field
      let points: Points | undefined;
      world.requireSceneEntity(NODE_IDS.field).object3D!.traverse((child) => {
        if (child instanceof Points && child.material instanceof ShaderMaterial) points = child;
      });
      if (!points) throw new Error('Particle garden points not found');
      const field = points;
      const u = (field.material as ShaderMaterial).uniforms as unknown as GardenUniforms;

      // Moods: colours fade between palettes when a hand enters a zone.
      const from = { a: new Color(), b: new Color() };
      const to = { a: new Color(), b: new Color() };
      let fade = 1;
      let mood: GardenMood = 'Lagoon';
      const zoneMaterials = new Map<GardenMood, MeshStandardMaterial>();
      const moodButtons = new Map<GardenMood, ReturnType<typeof bindButton>>();
      const setMood = (next: GardenMood, instant = false) => {
        mood = next;
        from.a.copy(u.uColorA.value);
        from.b.copy(u.uColorB.value);
        to.a.set(GARDEN_MOODS[next][0]);
        to.b.set(GARDEN_MOODS[next][1]);
        fade = instant ? 1 : 0;
        if (instant) {
          u.uColorA.value.copy(to.a);
          u.uColorB.value.copy(to.b);
        }
        zoneMaterials.forEach((material, name) => {
          material.emissive.set(name === next ? GARDEN_MOODS[name][0] : '#000000');
          material.emissiveIntensity = name === next ? 0.8 : 0;
        });
        moodButtons.forEach((button, name) => button.setSelected(name === next));
      };

      for (const [name, nodeId] of Object.entries(ZONES) as Array<[GardenMood, string]>) {
        const zone = world.requireSceneEntity(nodeId);
        zone.object3D!.traverse((child) => {
          if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
            child.material = child.material.clone(); // per-zone tint
            child.material.color.set(GARDEN_MOODS[name][0]);
            zoneMaterials.set(name, child.material);
          }
        });
        track(
          createProximityTrigger(ctx, zone, {
            radius: 0.1,
            onEnter: (hand) => {
              if (mood === name) return;
              setMood(name);
              haptics.play(hand, 'select');
              sounds.play('select');
            },
          }),
        );
      }

      // Panel
      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const common = { theme, onFeedback: standardFeedback(ctx) };
      const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2 }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
      track(bindTabs(panel, ['garden', 'audio', 'session'].map((n) => ({ tab: `tab-${n}`, page: `page-${n}` })), common));
      const steps: Record<string, number> = { density: 500, turbulence: 0.01, speed: 0.05, radius: 0.01, size: 0.05, reactivity: 0.05 };
      for (const [id, step] of Object.entries(steps)) {
        const format = id === 'density' ? (v: number) => v.toFixed(0) : undefined;
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step, format }));
        track(bindUI(params, id, control));
      }
      for (const name of Object.keys(GARDEN_MOODS) as GardenMood[]) {
        moodButtons.set(name, track(bindButton(panel, `mood-${name.toLowerCase()}`, { ...common, onClick: () => setMood(name) })));
      }
      setMood('Lagoon', true);
      bindAudioSection(ctx, panel, common);
      bindSessionSection(ctx, panel, common);

      // Per frame
      const { gripSpaces } = world.player;
      const hands = ['left', 'right'] as const;
      const handPosition = new Vector3();
      let time = 0;
      frame = (dt) => {
        menu.update();
        time += dt * params.get('speed');
        u.uTime.value = time;
        u.uTurbulence.value = params.get('turbulence');
        u.uSize.value = params.get('size');
        u.uHandRadius.value = params.get('radius');
        u.uSparkle.value = params.get('sparkle');
        u.uBurst.value = params.get('burst');
        field.geometry.setDrawRange(0, Math.round(params.get('density')));

        // Viewport half-height for physically sized points (per eye in XR).
        const layer = world.renderer.xr.isPresenting ? world.renderer.xr.getBaseLayer() : null;
        u.uViewportHalfHeight.value =
          (layer && 'framebufferHeight' in layer ? layer.framebufferHeight : world.renderer.domElement.height) / 2;

        // Hands: open = repel (-1), pinch / trigger = attract (+1), absent = 0.
        hands.forEach((hand, i) => {
          const slot = u.uHands.value[i]!;
          if (!world.input.xr.getPrimaryInputSource(hand)) {
            slot.w = 0;
            return;
          }
          gripSpaces[hand].getWorldPosition(handPosition);
          slot.set(handPosition.x, handPosition.y, handPosition.z, world.input.xr.getSelectState(hand).active ? 1 : -1);
        });

        if (fade < 1) {
          fade = Math.min(1, fade + dt / MOOD_FADE_SECONDS);
          u.uColorA.value.lerpColors(from.a, to.a, fade);
          u.uColorB.value.lerpColors(from.b, to.b, fade);
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
