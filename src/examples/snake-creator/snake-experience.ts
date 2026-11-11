import {
  BufferAttribute,
  BufferGeometry,
  Grabbed,
  Hovered,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type Entity,
  type UIKitMLAsset,
} from '@iwsdk/core';
import { makeManipulable } from '../../components/interaction/manipulable.js';
import { bindColorPicker } from '../../components/ui/controls-advanced.js';
import { bindButton, bindSlider, bindTabs, bindToggle, requireElement } from '../../components/ui/controls.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import { bindSessionSection, standardFeedback } from '../../components/ui/standard-sections.js';
import { bindUI, controlOptions, toggleOptions } from '../../core/parameters/bindings.js';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { crawlAt } from './crawl.js';
import { sampleCurve } from './curve.js';
import { SNAKE_PALETTES, type SnakePaletteName } from './gradient.js';
import {
  deleteAnchors,
  distance,
  fitPathFromStroke,
  insertAnchor,
  isLoopStroke,
  moveAnchor,
  segmentCount,
  simplifyStroke,
  strokeLength,
  type Anchor,
  type Point,
} from './path.js';
import type { SnakePattern } from './snake-glsl.js';
import { createSnakeRenderer, type SnakeLook } from './snake-renderer.js';

export const NODE_IDS = { panel: 'snake-panel' } as const;

export const SNAKE_PARAMS = {
  thickness: { default: 0.02, min: 0.005, max: 0.06, smoothing: 0.1, label: 'Thickness' },
  length: { default: 0.35, min: 0.05, max: 0.95, smoothing: 0.1, label: 'Length' },
  headTaper: { default: 0.1, min: 0, max: 0.5, label: 'Head taper' },
  tailTaper: { default: 0.5, min: 0, max: 1, label: 'Tail taper' },
  headShape: { default: 0.6, min: 0, max: 1, label: 'Head shape' },
  twist: { default: 0, min: 0, max: 6, label: 'Twist' },
  scale: { default: 1, min: 0.2, max: 4, label: 'Pattern scale' },
  width: { default: 0.5, min: 0, max: 1, label: 'Pattern width' },
  metallic: { default: 0.1, min: 0, max: 1, label: 'Metallic' },
  roughness: { default: 0.4, min: 0.05, max: 1, label: 'Roughness' },
  speed: { default: 0.15, min: 0, max: 1, smoothing: 0.2, label: 'Speed' },
  reverse: { default: 0, type: 'boolean', label: 'Reverse' },
  hilbertAnimate: { default: 0, type: 'boolean', label: 'Animate Hilbert trail' },
} satisfies Record<string, ParameterDefinition>;

const FG_PALETTE = ['#00d9c7', '#ff9500', '#a879ff', '#f1f7f5', '#ff5a6e'] as const;
const BG_PALETTE = ['#071514', '#152322', '#2b0a3d', '#f1f7f5', '#ff9500'] as const;
const PROFILES = { Round: 0, Square: 4, Hex: 6 } as const;
const MIN_STROKE = 0.1; // metres
const POINT_SPACING = 0.008; // metres between recorded stroke points
const MAX_STROKE_POINTS = 2048;

/** Demo shapes so desktop users (no hands to draw with) see a snake immediately. */
const demoLoop = (): { path: Anchor[]; closed: boolean } => {
  const points: Point[] = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { x: Math.sin(a) * 0.35, y: 1.3 + Math.sin(a * 2) * 0.12, z: -1 + Math.sin(a) * Math.cos(a) * 0.35 };
  });
  return { path: fitPathFromStroke(points, { closed: true }), closed: true };
};
const demoWave = (): { path: Anchor[]; closed: boolean } => {
  const points: Point[] = Array.from({ length: 7 }, (_, i) => ({ x: -0.45 + i * 0.15, y: 1.25 + (i % 2 ? 0.12 : -0.05), z: -0.95 + (i % 3) * 0.05 }));
  return { path: fitPathFromStroke(points), closed: false };
};

type Tool = 'draw' | 'edit' | 'view';

/**
 * Example 3 — Snake Creator. Draw a curve in the air, edit its anchors, style the snake from the
 * menu and watch it crawl (endlessly on closed loops). Renderer ported from shader-lab (Karleido).
 */
export const createSnakeExperience = (): Experience<ExperienceContext> => {
  let frame: ((dt: number) => void) | undefined;

  return {
    init(ctx) {
      const { world, params, theme, haptics, sounds, track } = ctx;
      for (const [id, definition] of Object.entries(SNAKE_PARAMS)) params.define(id, definition);

      // --- Snake -------------------------------------------------------------------------
      const renderer = track(createSnakeRenderer());
      track(world.createTransformEntity(renderer.mesh));
      let path: Anchor[] = [];
      let closed = false;
      const look: SnakeLook = {
        thickness: 0.02, length: 0.35, headTaper: 0.1, tailTaper: 0.5, headShape: 0.6, profile: 0, twist: 0,
        pattern: 'rings', scale: 1, width: 0.5, foreground: FG_PALETTE[0], background: BG_PALETTE[0],
        gradient: false, metallic: 0.1, roughness: 0.4, hilbertAnimate: false, hilbertLength: 0.25,
      };
      let palette: SnakePaletteName = 'Cyberdelic';
      renderer.setGradient(SNAKE_PALETTES[palette]);

      // --- Panel -------------------------------------------------------------------------
      const panel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.panel);
      const panelEntity = world.requireSceneEntity(NODE_IDS.panel);
      requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const common = { theme, onFeedback: standardFeedback(ctx) };
      const menu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.panel, distance: 0.6, drop: 0.2 }));
      track(bindButton(panel, 'btn-hide', { ...common, onClick: () => menu.hide() }));
      track(bindTabs(panel, ['draw', 'shape', 'look', 'motion', 'session'].map((n) => ({ tab: `tab-${n}`, page: `page-${n}` })), common));
      const pathInfo = requireElement(panel, 'path-info');
      const hint = requireElement(panel, 'draw-hint');

      // --- Anchor handles (Edit tool) ------------------------------------------------------
      const handleGeometry = track(new SphereGeometry(0.018, 16, 12));
      const handleMaterial = track(new MeshStandardMaterial({ color: theme.colors.primary, roughness: 0.3, emissive: theme.colors.primary, emissiveIntensity: 0.3 }));
      const selectedMaterial = track(new MeshStandardMaterial({ color: theme.colors.secondary, roughness: 0.3, emissive: theme.colors.secondary, emissiveIntensity: 0.6 }));
      let handles: Entity[] = [];
      let selected = -1;
      let tool: Tool = 'view';
      const handlePosition = new Vector3();

      const clearHandles = () => {
        handles.forEach((handle) => handle.dispose());
        handles = [];
      };
      const buildHandles = () => {
        clearHandles();
        if (tool !== 'edit') return;
        handles = path.map((anchor, i) => {
          const mesh = new Mesh(handleGeometry, i === selected ? selectedMaterial : handleMaterial);
          mesh.position.set(anchor.point.x, anchor.point.y, anchor.point.z);
          return makeManipulable(world.createTransformEntity(mesh), { grab: 'distance', rotate: false, scale: false });
        });
      };
      track(clearHandles);

      const refreshCurve = () => {
        const curve = sampleCurve(path, closed);
        renderer.setCurve(curve);
        pathInfo.setProperties({
          text: curve ? `${path.length} points | ${curve.length.toFixed(2)} m | ${closed ? 'closed loop' : 'open path'}` : 'No path: draw one or load a demo',
        });
      };
      const setPath = (next: Anchor[], nextClosed: boolean) => {
        path = next;
        closed = nextClosed && next.length >= 3;
        if (selected >= path.length) selected = -1;
        closedToggle.setValue(closed);
        refreshCurve();
        buildHandles();
      };

      // Tools
      const toolButtons = new Map<Tool, ReturnType<typeof bindButton>>();
      const hints: Record<Tool, string> = {
        draw: 'Draw: hold trigger or pinch with your right hand and move it through the air. End near the start for a loop.',
        edit: 'Edit: grab the dots with a ray to reshape. The last one you grabbed is selected (orange).',
        view: 'View: watch the snake. Pick Draw or Edit to change the path.',
      };
      const setTool = (next: Tool) => {
        tool = next;
        toolButtons.forEach((button, name) => button.setSelected(name === next));
        hint.setProperties({ text: hints[next] });
        buildHandles();
      };
      for (const name of ['draw', 'edit', 'view'] as const) {
        toolButtons.set(name, track(bindButton(panel, `tool-${name}`, { ...common, onClick: () => setTool(name) })));
      }
      const closedToggle = track(
        bindToggle(panel, 'closed', { ...common, value: false, onChange: (value) => setPath(path, value) }),
      );
      track(
        bindButton(panel, 'btn-add', {
          ...common,
          onClick: () => {
            if (path.length < 2) return;
            const segment = selected >= 0 ? Math.min(selected, segmentCount(path, closed) - 1) : Math.floor(segmentCount(path, closed) / 2);
            selected = segment + 1;
            setPath(insertAnchor(path, segment, 0.5, closed), closed);
          },
        }),
      );
      track(
        bindButton(panel, 'btn-delete', {
          ...common,
          onClick: () => {
            if (selected < 0) return;
            const next = deleteAnchors(path, new Set([selected]));
            selected = -1;
            setPath(next, closed && next.length >= 3);
          },
        }),
      );
      track(bindButton(panel, 'btn-demo-loop', { ...common, onClick: () => { const d = demoLoop(); setPath(d.path, d.closed); } }));
      track(bindButton(panel, 'btn-demo-wave', { ...common, onClick: () => { const d = demoWave(); setPath(d.path, d.closed); } }));
      track(bindButton(panel, 'btn-clear', { ...common, onClick: () => setPath([], false) }));

      // Shape / look / motion parameters (two-way bound to the store).
      const sliderSteps: Record<string, number> = {
        thickness: 0.001, length: 0.01, headTaper: 0.01, tailTaper: 0.01, headShape: 0.01, twist: 0.25,
        scale: 0.05, width: 0.01, metallic: 0.01, roughness: 0.01, speed: 0.01,
      };
      for (const [id, step] of Object.entries(sliderSteps)) {
        const format = id === 'thickness' ? (v: number) => v.toFixed(3) : undefined;
        const control = track(bindSlider(panel, id, { ...common, ...controlOptions(params, id), step, format }));
        track(bindUI(params, id, control));
      }
      for (const id of ['reverse', 'hilbertAnimate'] as const) {
        const control = track(bindToggle(panel, id, { ...common, ...toggleOptions(params, id) }));
        track(bindUI(params, id, control));
      }
      const profileButtons = (Object.keys(PROFILES) as Array<keyof typeof PROFILES>).map((name) => ({
        name,
        button: track(bindButton(panel, `profile-${name.toLowerCase()}`, { ...common, selected: name === 'Round', onClick: () => setProfile(name) })),
      }));
      const setProfile = (name: keyof typeof PROFILES) => {
        look.profile = PROFILES[name];
        profileButtons.forEach((p) => p.button.setSelected(p.name === name));
      };
      const patternButtons = (['solid', 'rings', 'hilbert'] as SnakePattern[]).map((name) => ({
        name,
        button: track(bindButton(panel, `pattern-${name}`, { ...common, selected: name === look.pattern, onClick: () => setPattern(name) })),
      }));
      const setPattern = (name: SnakePattern) => {
        look.pattern = name;
        patternButtons.forEach((p) => p.button.setSelected(p.name === name));
      };
      track(bindColorPicker(panel, 'fg', { ...common, palette: FG_PALETTE, value: look.foreground, onChange: (hex) => (look.foreground = hex) }));
      const bgButtons = BG_PALETTE.map((hex, i) => {
        requireElement(panel, `bg-swatch-${i}`).setProperties({ backgroundColor: hex });
        return track(bindButton(panel, `bg-swatch-${i}`, { ...common, selected: i === 0, onClick: () => { look.background = hex; bgButtons.forEach((b, j) => b.setSelected(j === i)); } }));
      });
      track(bindToggle(panel, 'gradient', { ...common, value: false, onChange: (v) => (look.gradient = v) }));
      const paletteButtons = (Object.keys(SNAKE_PALETTES) as SnakePaletteName[]).map((name) => ({
        name,
        button: track(bindButton(panel, `palette-${name.toLowerCase()}`, {
          ...common,
          selected: name === palette,
          onClick: () => {
            palette = name;
            renderer.setGradient(SNAKE_PALETTES[name]);
            paletteButtons.forEach((p) => p.button.setSelected(p.name === name));
          },
        })),
      }));
      bindSessionSection(ctx, panel, common);

      // --- Drawing ---------------------------------------------------------------------------
      const strokePositions = new Float32Array(MAX_STROKE_POINTS * 3);
      const strokeGeometry = track(new BufferGeometry());
      strokeGeometry.setAttribute('position', new BufferAttribute(strokePositions, 3));
      strokeGeometry.setDrawRange(0, 0);
      const strokeMaterial = track(new LineBasicMaterial({ color: theme.colors.secondary }));
      const strokeLine = new Line(strokeGeometry, strokeMaterial);
      strokeLine.frustumCulled = false;
      track(world.createTransformEntity(strokeLine));
      let stroke: Point[] | undefined;
      const pen = new Vector3();
      const penForward = new Vector3();

      const penPosition = (): Vector3 => {
        const { player } = world;
        if (world.input.xr.isPrimary('hand', 'right')) return player.indexTipSpaces.right.getWorldPosition(pen);
        // Controllers: a few centimetres in front of the controller along its ray.
        player.raySpaces.right.getWorldPosition(pen);
        player.raySpaces.right.getWorldDirection(penForward);
        return pen.addScaledVector(penForward, -0.06);
      };

      const finishStroke = () => {
        const points = stroke ?? [];
        stroke = undefined;
        strokeGeometry.setDrawRange(0, 0);
        if (strokeLength(points) < MIN_STROKE) {
          sounds.play('release');
          return;
        }
        const loop = isLoopStroke(points);
        const simplified = simplifyStroke(points, 0.012);
        setPath(fitPathFromStroke(simplified, { closed: loop }), loop);
        haptics.play('right', 'select');
        sounds.play('select');
      };

      const updateDrawing = () => {
        const select = world.input.xr.getSelectState('right');
        if (!stroke) {
          // Start only when not pointing at the menu.
          if (tool === 'draw' && select.start && !panelEntity.hasComponent(Hovered) && world.input.xr.getPrimaryInputSource('right')) {
            stroke = [];
            haptics.play('right', 'click');
          }
          return;
        }
        if (!select.active) {
          finishStroke();
          return;
        }
        const p = penPosition();
        const point = { x: p.x, y: p.y, z: p.z };
        const last = stroke[stroke.length - 1];
        if ((!last || distance(last, point) >= POINT_SPACING) && stroke.length < MAX_STROKE_POINTS) {
          stroke.push(point);
          strokePositions.set([point.x, point.y, point.z], (stroke.length - 1) * 3);
          strokeGeometry.attributes.position!.needsUpdate = true;
          strokeGeometry.setDrawRange(0, stroke.length);
        }
      };

      // --- Editing ---------------------------------------------------------------------------
      const updateEditing = () => {
        if (tool !== 'edit') return;
        let changed = false;
        handles.forEach((handle, i) => {
          const object = handle.object3D!;
          if (handle.hasComponent(Grabbed)) {
            if (selected !== i) {
              selected = i;
              handles.forEach((h, j) => ((h.object3D as Mesh).material = j === i ? selectedMaterial : handleMaterial));
            }
            object.getWorldPosition(handlePosition);
            const anchor = path[i]!.point;
            if (Math.abs(anchor.x - handlePosition.x) + Math.abs(anchor.y - handlePosition.y) + Math.abs(anchor.z - handlePosition.z) > 1e-4) {
              path = moveAnchor(path, i, { x: handlePosition.x, y: handlePosition.y, z: handlePosition.z });
              changed = true;
            }
          } else {
            const anchor = path[i]!.point;
            object.position.set(anchor.x, anchor.y, anchor.z);
          }
        });
        if (changed) refreshCurve();
      };

      // --- Start state -------------------------------------------------------------------------
      const demo = demoLoop();
      setPath(demo.path, demo.closed);
      setTool('view');
      setPattern('rings');

      let clock = 0;
      let hilbertPhase = 0;
      frame = (dt) => {
        menu.update();
        updateDrawing();
        updateEditing();
        clock += dt * params.get('speed');
        if (params.get('hilbertAnimate') >= 0.5) hilbertPhase += dt * 0.15;
        look.thickness = params.get('thickness');
        look.length = params.get('length');
        look.headTaper = params.get('headTaper');
        look.tailTaper = params.get('tailTaper');
        look.headShape = params.get('headShape');
        look.twist = params.get('twist');
        look.scale = params.get('scale');
        look.width = params.get('width');
        look.metallic = params.get('metallic');
        look.roughness = params.get('roughness');
        look.hilbertAnimate = params.get('hilbertAnimate') >= 0.5;
        const crawl = crawlAt(clock, { speed: 1, length: look.length, closed, reverse: params.get('reverse') >= 0.5 });
        renderer.apply(look, crawl, hilbertPhase);
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
