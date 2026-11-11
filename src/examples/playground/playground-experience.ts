import { Mesh, MeshStandardMaterial, VisibilityState, type Object3D, type UIKitMLAsset } from '@iwsdk/core';
import { createSpatialSound } from '../../components/audio/spatial-sound.js';
import {
  createGazeTrigger,
  createInteractionHighlight,
  createPressTrigger,
  createProximityTrigger,
  makeDraggable,
  makeRotatable,
  makeScalable,
} from '../../components/interaction/behaviors.js';
import { createGrabHapticsSystem } from '../../components/interaction/manipulable.js';
import { createSurfacePlacer, type PlacementStatus } from '../../components/interaction/surface-placement.js';
import { createOscMonitor } from '../../components/osc/osc-monitor.js';
import { bindColorPicker, bindDropdown, bindValueDisplay } from '../../components/ui/controls-advanced.js';
import { bindButton, bindSlider, bindStatus, bindTabs, requireElement, type Feedback } from '../../components/ui/controls.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { panelStyle } from '../../themes/cyberdelic.js';

/** Scene node ids in public/scenes/playground.iwsdk.scene.json. */
export const NODE_IDS = {
  panel: 'playground-panel',
  toolbar: 'toolbar',
  cube: 'rotatable-cube',
  gem: 'scalable-gem',
  knob: 'draggable-knob',
  ring: 'proximity-ring',
  gazeOrb: 'gaze-orb',
  button: 'press-button',
} as const;

const ACCENTS = { Teal: '#00D9C7', Orange: '#FF9500', Violet: '#A879FF' } as const;
type Accent = keyof typeof ACCENTS;
const CUBE_PALETTE = ['#00d9c7', '#ff9500', '#a879ff', '#f1f7f5', '#ff5a6e'] as const;

const firstMaterial = (object: Object3D): MeshStandardMaterial | undefined => {
  let found: MeshStandardMaterial | undefined;
  object.traverse((child) => {
    if (!found && child instanceof Mesh && child.material instanceof MeshStandardMaterial) found = child.material;
  });
  return found;
};

/**
 * Developer Playground (PRD §12.3): every UI control, interaction trigger, sound helper,
 * MR surface placement and the OSC monitor in one scene. Open with ?example=playground.
 */
export const createPlaygroundExperience = (): Experience<ExperienceContext> => ({
  init(ctx) {
    const { world, theme, haptics, sounds, track } = ctx;
    const entity = (id: string) => world.requireSceneEntity(id);
    const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
    const toolbar = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.toolbar);
    requireElement(panel, 'panel').setProperties(panelStyle(theme));
    const feedback = (kind: Feedback) => {
      if (kind === 'press') {
        haptics.playActive('click');
        sounds.play('click');
      } else if (kind === 'change') {
        haptics.playActive('select');
        sounds.play('select');
      }
    };
    const common = { theme, onFeedback: feedback };
    const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2 }));
    ctx.onFrame(() => menu.update());
    track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
    track(bindTabs(panel, ['controls', 'triggers', 'osc'].map((n) => ({ tab: `tab-${n}`, page: `page-${n}` })), common));

    // Event log (Label component).
    const logLines = Array.from({ length: 5 }, (_, i) => requireElement(panel, `log-${i}`));
    const log: string[] = [];
    const say = (text: string) => {
      log.unshift(text);
      log.length = Math.min(log.length, logLines.length);
      logLines.forEach((line, i) => line.setProperties({ text: log[i] ?? ' ' }));
    };

    // --- Interaction components -------------------------------------------------------
    const cube = entity(NODE_IDS.cube);
    const gem = entity(NODE_IDS.gem);
    const knob = entity(NODE_IDS.knob);
    makeRotatable(cube);
    makeScalable(gem, { min: 0.4, max: 3 });
    makeDraggable(knob, { axis: 'x', range: 0.28 });
    world.registerSystem(createGrabHapticsSystem(haptics));

    let accent: string = ACCENTS.Teal;
    for (const e of [cube, gem, knob, entity(NODE_IDS.button)]) track(createInteractionHighlight(ctx, e, { color: () => accent }));

    const ringMaterial = firstMaterial(entity(NODE_IDS.ring).object3D!);
    track(
      createProximityTrigger(ctx, entity(NODE_IDS.ring), {
        radius: 0.1,
        onEnter: (hand) => {
          ringMaterial?.color.set(theme.colors.primary);
          haptics.play(hand, 'select');
          sounds.play('select');
          say(`Proximity: ${hand} hand entered the ring`);
        },
        onExit: () => {
          ringMaterial?.color.set(theme.colors.muted);
          say('Proximity: left the ring');
        },
      }),
    );

    const gazeMaterial = firstMaterial(entity(NODE_IDS.gazeOrb).object3D!);
    const gazeBar = requireElement(panel, 'gaze-progress');
    let lastProgress = -1;
    track(
      createGazeTrigger(ctx, entity(NODE_IDS.gazeOrb), {
        dwell: 1.2,
        onProgress: (progress) => {
          const rounded = Math.round(progress * 20) / 20;
          if (rounded === lastProgress) return;
          lastProgress = rounded;
          gazeBar.setProperties({ width: `${rounded * 100}%` });
          gazeMaterial?.emissive.set(theme.colors.secondary);
          if (gazeMaterial) gazeMaterial.emissiveIntensity = rounded;
        },
        onTrigger: () => {
          sounds.play('select');
          say('Gaze: dwell complete');
        },
      }),
    );

    // Press button doubles as a spatial sound emitter (synth hum, positional).
    const buttonObject = entity(NODE_IDS.button).object3D!;
    const hum = track(
      createSpatialSound(ctx, buttonObject, {
        node: (context) => {
          const osc = context.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = 110;
          osc.start();
          return osc;
        },
      }, { volume: 0.25 }),
    );
    let humming = false;
    const toggleHum = () => {
      humming = !humming;
      if (humming) void hum.play();
      else hum.stop();
      say(humming ? 'Spatial sound: hum playing (walk around it)' : 'Spatial sound: stopped');
    };
    track(
      createPressTrigger(ctx, entity(NODE_IDS.button), () => {
        haptics.playActive('impact');
        sounds.play('grab');
        say('Press: orange button pressed');
      }),
    );

    // MR surface placement for the cube.
    const placer = track(
      createSurfacePlacer(ctx, cube, {
        onStatus: (status: PlacementStatus) =>
          say(
            status === 'aiming'
              ? 'Place: point at a surface, pull trigger'
              : status === 'unsupported'
                ? 'Place: needs an MR session with hit-test'
                : 'Place: done',
          ),
      }),
    );

    // --- UI controls ------------------------------------------------------------------
    track(
      bindDropdown(panel, 'accent', {
        ...common,
        options: Object.keys(ACCENTS) as Accent[],
        value: 'Teal',
        onChange: (name) => {
          accent = ACCENTS[name];
          say(`Dropdown: accent ${name}`);
        },
      }),
    );
    const cubeMaterial = firstMaterial(cube.object3D!);
    track(
      bindColorPicker(panel, 'cube-color', {
        ...common,
        palette: CUBE_PALETTE,
        value: CUBE_PALETTE[0],
        onChange: (hex) => cubeMaterial?.color.set(hex),
      }),
    );
    const readout = bindValueDisplay(panel, 'gem-readout', (v) => `${v.toFixed(2)}x`);
    const gemObject = gem.object3D!;
    track(
      bindSlider(panel, 'gem-size', {
        ...common,
        min: 0.4,
        max: 3,
        step: 0.05,
        value: 1,
        onChange: (v) => {
          gemObject.scale.setScalar(v);
          readout(v);
        },
      }),
    );
    // Two-hand scaling also updates the readout.
    ctx.onFrame(() => readout(gemObject.scale.x));

    // --- Toolbar (IconButtons) ----------------------------------------------------------
    const homes = [cube, gem, knob].map((e) => ({ object: e.object3D!, position: e.object3D!.position.clone(), quaternion: e.object3D!.quaternion.clone(), scale: e.object3D!.scale.clone() }));
    const reset = () => {
      homes.forEach(({ object, position, quaternion, scale }) => {
        object.position.copy(position);
        object.quaternion.copy(quaternion);
        object.scale.copy(scale);
      });
      say('Toolbar: reset');
    };
    track(bindButton(toolbar, 'tb-reset', { ...common, onClick: reset }));
    track(bindButton(toolbar, 'tb-sound', { ...common, onClick: toggleHum }));
    track(bindButton(toolbar, 'tb-place', { ...common, onClick: () => placer.start() }));
    track(bindButton(toolbar, 'tb-menu', { ...common, onClick: () => menu.toggle() }));
    track(bindButton(panel, 'btn-place', { ...common, onClick: () => placer.start() }));
    track(bindButton(panel, 'btn-sound', { ...common, onClick: toggleHum }));

    // --- OSC monitor --------------------------------------------------------------------
    const setOsc = bindStatus(panel, { dot: 'osc-dot', text: 'osc-status' }, theme);
    const oscLast = requireElement(panel, 'osc-last');
    const rateLines = Array.from({ length: 4 }, (_, i) => requireElement(panel, `osc-rate-${i}`));
    if (ctx.osc) {
      const osc = ctx.osc;
      const monitor = createOscMonitor({ window: 1 });
      const showStatus = () =>
        setOsc(osc.status === 'open' ? 'ok' : osc.status === 'connecting' ? 'warn' : 'error', `OSC ${osc.status} (${osc.url})`);
      track(osc.onStatus(showStatus));
      showStatus();
      track(osc.onAny((args, address) => monitor.record(address, args, performance.now() / 1000)));
      let clock = 0;
      ctx.onFrame((dt) => {
        clock += dt;
        if (clock < 0.5) return;
        clock = 0;
        const { last, addresses } = monitor.stats(performance.now() / 1000);
        if (last) oscLast.setProperties({ text: `${last.address} ${last.args.map(String).join(' ')}  @ ${last.time.toFixed(1)}s` });
        rateLines.forEach((line, i) => {
          const entry = addresses[i];
          line.setProperties({ text: entry ? `${entry.address}  ${entry.rate.toFixed(0)} msg/s` : ' ' });
        });
      });
    } else setOsc('idle', 'OSC disabled (osc: true in createExperience)');

    // Session status.
    const setMode = bindStatus(panel, { dot: 'mode-dot', text: 'status' }, theme);
    track(
      world.visibilityState.subscribe((state) => {
        const immersive = state !== VisibilityState.NonImmersive;
        const blend = world.session?.environmentBlendMode;
        setMode(immersive ? 'ok' : 'idle', !immersive ? 'Desktop preview  |  M toggles menu' : blend && blend !== 'opaque' ? 'Mixed reality' : 'Virtual reality');
      }),
    );
    say('Playground ready');
  },
});
