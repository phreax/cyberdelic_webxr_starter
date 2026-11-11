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
import { GARDEN_BOUNDS } from '../../scene-assets/particle-garden.scene-asset.js';
import { createFlowField, decayField, stampField } from './flow-field.js';
import { createParticleLayout } from './garden-math.js';
import { createParticleSim, SIM_PARTICLES } from './particle-sim.js';
import { GARDEN_MOODS, type GardenMood } from './garden-math.js';
import type { GardenUniforms } from './particle-material.js';

export const NODE_IDS = { field: 'particle-garden', panel: 'garden-panel' } as const;
const ZONES: Record<GardenMood, string> = { Lagoon: 'zone-lagoon', Ember: 'zone-ember', Aurora: 'zone-aurora' };

export const GARDEN_PARAMS = {
  density: { default: 14000, min: 2000, max: SIM_PARTICLES, label: 'Density' },
  turbulence: { default: 0.12, min: 0, max: 0.4, smoothing: 0.25, label: 'Turbulence' },
  speed: { default: 1, min: 0, max: 3, smoothing: 0.3, label: 'Flow speed' },
  stir: { default: 1, min: 0, max: 2, smoothing: 0.1, label: 'Stir strength' },
  memory: { default: 2.5, min: 0.3, max: 8, label: 'Field memory (s)' },
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
      const steps: Record<string, number> = { density: 500, turbulence: 0.01, speed: 0.05, stir: 0.05, memory: 0.1, size: 0.05, reactivity: 0.05 };
      for (const [id, step] of Object.entries(steps)) {
        const format = id === 'density' ? (v: number) => v.toFixed(0) : id === 'memory' ? (v: number) => `${v.toFixed(1)} s` : undefined;
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step, format }));
        track(bindUI(params, id, control));
      }
      for (const name of Object.keys(GARDEN_MOODS) as GardenMood[]) {
        moodButtons.set(name, track(bindButton(panel, `mood-${name.toLowerCase()}`, { ...common, onClick: () => setMood(name) })));
      }
      setMood('Lagoon', true);
      bindAudioSection(ctx, panel, common);
      bindSessionSection(ctx, panel, common);

      // Hand-stirred flow field + GPU simulation (falls back to stateless particles).
      const box = {
        min: [0, 1, 2].map((i) => GARDEN_BOUNDS.center[i]! - GARDEN_BOUNDS.radius[i]! - 0.15) as [number, number, number],
        max: [0, 1, 2].map((i) => GARDEN_BOUNDS.center[i]! + GARDEN_BOUNDS.radius[i]! + 0.15) as [number, number, number],
      };
      const flowField = createFlowField(box, [12, 8, 12]);
      const layout = createParticleLayout(SIM_PARTICLES, 7, GARDEN_BOUNDS);
      const sim = createParticleSim(world.renderer, { ...layout, center: GARDEN_BOUNDS.center, radius: GARDEN_BOUNDS.radius, field: flowField });
      const simulated = sim.error === undefined ? sim : undefined;
      if (simulated) {
        field.visible = false;
        track(world.createTransformEntity(simulated.points));
        track(simulated);
      } else {
        console.info(`[garden] ${sim.error}`);
      }

      // Per frame
      const { gripSpaces } = world.player;
      const hands = ['left', 'right'] as const;
      const handPosition = new Vector3();
      const previous = { left: new Vector3(), right: new Vector3() };
      const tracked = { left: false, right: false };
      const velocity: [number, number, number] = [0, 0, 0];
      let time = 0;
      frame = (dt) => {
        menu.update();
        time += dt * params.get('speed');
        const half = (world.renderer.xr.isPresenting ? world.renderer.xr.getBaseLayer() : null) as { framebufferHeight?: number } | null;
        const viewportHalfHeight = (half?.framebufferHeight ?? world.renderer.domElement.height) / 2;

        // Hands: moving hands stir the field; pinch / trigger attracts.
        hands.forEach((hand, i) => {
          const slot = u.uHands.value[i]!;
          if (!world.input.xr.getPrimaryInputSource(hand)) {
            slot.w = 0;
            tracked[hand] = false;
            return;
          }
          gripSpaces[hand].getWorldPosition(handPosition);
          const pinching = world.input.xr.getSelectState(hand).active;
          slot.set(handPosition.x, handPosition.y, handPosition.z, pinching ? 1 : -1);
          if (tracked[hand] && dt > 0) {
            velocity[0] = (handPosition.x - previous[hand].x) / dt;
            velocity[1] = (handPosition.y - previous[hand].y) / dt;
            velocity[2] = (handPosition.z - previous[hand].z) / dt;
            const speed = Math.hypot(...velocity);
            if (speed > 0.05) stampField(flowField, [handPosition.x, handPosition.y, handPosition.z], velocity.map((v) => v * dt * 6) as [number, number, number], 0.18);
          }
          previous[hand].copy(handPosition);
          tracked[hand] = true;
        });
        decayField(flowField, dt, params.get('memory'));

        if (simulated) {
          const su = simulated.simUniforms;
          su.uTurbulence!.value = params.get('turbulence');
          su.uStir!.value = params.get('stir');
          su.uBurst!.value = params.get('burst');
          (su.uHands!.value as typeof u.uHands.value).forEach((v, i) => v.copy(u.uHands.value[i]!));
          simulated.step(dt * Math.max(0.05, params.get('speed')));
          const ru = simulated.renderUniforms;
          ru.uSize.value = params.get('size');
          ru.uSparkle.value = params.get('sparkle');
          ru.uViewportHalfHeight.value = viewportHalfHeight;
          ru.uColorA.value.copy(u.uColorA.value);
          ru.uColorB.value.copy(u.uColorB.value);
          simulated.points.geometry.setDrawRange(0, Math.round(params.get('density')));
        } else {
          u.uTime.value = time;
          u.uTurbulence.value = params.get('turbulence');
          u.uSize.value = params.get('size');
          u.uHandRadius.value = 0.3;
          u.uSparkle.value = params.get('sparkle');
          u.uBurst.value = params.get('burst');
          u.uViewportHalfHeight.value = viewportHalfHeight;
          field.geometry.setDrawRange(0, Math.round(params.get('density')));
        }

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
