import { BufferAttribute, BufferGeometry, Hovered, InputComponent, Line, LineBasicMaterial, Vector3, type UIKitMLAsset } from '@iwsdk/core';
import { bindButton, bindSlider, bindTabs, bindToggle, requireElement, type UIElement } from '../../components/ui/controls.js';
import { createPanelMenu } from '../../components/ui/panel-menu.js';
import { bindSessionSection, standardFeedback } from '../../components/ui/standard-sections.js';
import { bindUI, controlOptions, toggleOptions } from '../../core/parameters/bindings.js';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import type { Experience } from '../../core/xr/lifecycle.js';
import { panelStyle } from '../../themes/cyberdelic.js';
import { sampleCurve } from './curve.js';
import { SNAKE_PALETTES, type SnakePaletteName } from './gradient.js';

const DEFAULT_PALETTE: SnakePaletteName = 'Ethereal Garden';
import {
  deleteAnchors,
  distance,
  fitPathFromStroke,
  insertAnchor,
  isLoopStroke,
  moveAnchor,
  segmentCount,
  simplifyStroke,
  smoothStroke,
  strokeLength,
  type Anchor,
  type Point,
} from './path.js';
import type { SnakePattern } from './snake-glsl.js';
import { effectiveTwist, type SnakeLook } from './snake-look.js';
import {
  addSnake,
  createSnakeState,
  deleteSnake,
  MAX_SNAKES,
  selectedSnake,
  selectSnake,
  setClosed,
  setEditing,
  updateSnake,
  type SnakeState,
} from './snake-model.js';
import { createSnakeObject, type SnakeObject } from './snake-object.js';

export const NODE_IDS = { list: 'snake-list', edit: 'snake-edit', params: 'snake-params' } as const;

/** Numeric / boolean look settings edited through the parameter store (UI binding only, no smoothing). */
export const SNAKE_PARAMS = {
  thickness: { default: 0.02, min: 0.005, max: 0.06, label: 'Thickness' },
  length: { default: 0.35, min: 0.05, max: 0.95, label: 'Length' },
  headTaper: { default: 0.1, min: 0, max: 0.5, label: 'Head taper' },
  tailTaper: { default: 0.5, min: 0, max: 1, label: 'Tail taper' },
  headShape: { default: 0.6, min: 0, max: 1, label: 'Head shape' },
  sphereDensity: { default: 0.5, min: 0, max: 1, label: 'Sphere density' },
  sphereSize: { default: 1, min: 0.4, max: 1.6, label: 'Sphere size' },
  twist: { default: 0, min: 0, max: 6, label: 'Twist' },
  spread: { default: 0.05, min: 0, max: 1, label: 'Gradient spread' },
  scale: { default: 1, min: 0.2, max: 4, label: 'Pattern scale' },
  width: { default: 0.5, min: 0, max: 1, label: 'Pattern width' },
  transparent: { default: 0, type: 'boolean', label: 'Transparent' },
  backgroundOffset: { default: 0.5, min: 0, max: 1, label: 'Hue offset' },
  backgroundBrightness: { default: 0, min: 0, max: 1.5, label: 'Brightness' },
  iridescence: { default: 0.1, min: 0, max: 1, label: 'Iridescence' },
  metallic: { default: 0.2, min: 0, max: 1, label: 'Metallic' },
  roughness: { default: 0.35, min: 0.05, max: 1, label: 'Roughness' },
  speed: { default: 0.15, min: 0, max: 1, label: 'Speed' },
  reverse: { default: 0, type: 'boolean', label: 'Reverse' },
} satisfies Record<string, ParameterDefinition>;
type ParamId = keyof typeof SNAKE_PARAMS;
const BOOLEAN_PARAMS = new Set<ParamId>(['transparent', 'reverse']);

const SLIDER_STEPS: Partial<Record<ParamId, number>> = {
  thickness: 0.001, length: 0.01, headTaper: 0.01, tailTaper: 0.01, headShape: 0.01, sphereDensity: 0.01, sphereSize: 0.05, twist: 0.25, spread: 0.01,
  scale: 0.05, width: 0.01, backgroundOffset: 0.01, backgroundBrightness: 0.01, iridescence: 0.01,
  metallic: 0.01, roughness: 0.01, speed: 0.01,
};

const MIN_STROKE = 0.1;
const POINT_SPACING = 0.008;
const MAX_STROKE_POINTS = 2048;

const demoLoopPath = (): Anchor[] =>
  fitPathFromStroke(
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return { x: Math.sin(a) * 0.35, y: 1.3 + Math.sin(a * 2) * 0.12, z: -1 + Math.sin(a) * Math.cos(a) * 0.35 };
    }),
    { closed: true },
  );
const demoWavePath = (): Anchor[] =>
  fitPathFromStroke(Array.from({ length: 7 }, (_, i) => ({ x: -0.45 + i * 0.15, y: 1.25 + (i % 2 ? 0.12 : -0.05), z: -0.95 + (i % 3) * 0.05 })));

type Tool = 'draw' | 'move';

/**
 * Example 3 — Snake Creator. A list of snakes (add / delete / select), an explicit edit mode that
 * shows only the curve and its vertices, and a settings window for the selected snake. Snakes can
 * be grabbed, moved and uniformly resized. Renderer ported from shader-lab (Karleido).
 */
export const createSnakeExperience = (): Experience<ExperienceContext> => {
  let frame: ((dt: number) => void) | undefined;

  return {
    init(ctx) {
      const { world, params, theme, haptics, sounds, track } = ctx;
      for (const [id, definition] of Object.entries(SNAKE_PARAMS)) params.define(id, definition);
      const common = { theme, onFeedback: standardFeedback(ctx) };

      let state: SnakeState = createSnakeState();
      const objects = new Map<string, SnakeObject>();
      let tool: Tool = 'draw';

      // --- Windows ------------------------------------------------------------------------
      const listPanel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.list);
      const editPanel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.edit);
      const paramsPanel = world.requireSceneObject<UIKitMLAsset>(NODE_IDS.params);
      for (const panel of [listPanel, editPanel, paramsPanel]) requireElement(panel, 'panel').setProperties(panelStyle(theme));
      const listEntity = world.requireSceneEntity(NODE_IDS.list);
      const editEntity = world.requireSceneEntity(NODE_IDS.edit);
      const paramsEntity = world.requireSceneEntity(NODE_IDS.params);

      // One window group: the list window owns the toggle inputs; the others follow it.
      const editMenu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.edit, inputs: false, summonOnShow: false }));
      const paramsMenu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.params, inputs: false, summonOnShow: false }));
      const syncWindows = (listVisible: boolean) => {
        if (listVisible && state.selectedId) paramsMenu.show();
        else paramsMenu.hide();
        if (listVisible && state.editing) editMenu.show();
        else editMenu.hide();
      };
      const listMenu = track(createPanelMenu(ctx, { nodeId: NODE_IDS.list, distance: 0.6, drop: 0.2, onVisibilityChange: syncWindows }));
      track(bindButton(listPanel, 'btn-hide', { ...common, onClick: () => listMenu.hide() }));
      bindSessionSection(ctx, listPanel, common);

      // --- State → scene ----------------------------------------------------------------------
      const rows = Array.from({ length: MAX_SNAKES }, (_, i) => ({
        row: requireElement(listPanel, `snake-row-${i}`),
        name: requireElement(listPanel, `snake-row-${i}-name`),
        info: requireElement(listPanel, `snake-row-${i}-info`),
      }));
      const listEmpty = requireElement(listPanel, 'list-empty');
      const editName = requireElement(editPanel, 'edit-name');
      const paramsName = requireElement(paramsPanel, 'params-name');
      const pathInfo = requireElement(editPanel, 'path-info');

      const render = () => {
        // Objects: create / update / remove to match the model.
        for (const snake of state.snakes) {
          let object = objects.get(snake.id);
          if (!object) {
            object = createSnakeObject(ctx, snake);
            objects.set(snake.id, object);
          }
          object.setRecord(snake);
          object.setMode(state.editing && snake.id === state.selectedId ? 'edit' : 'view');
        }
        for (const [id, object] of objects) {
          if (!state.snakes.some((snake) => snake.id === id)) {
            object.dispose();
            objects.delete(id);
          }
        }
        // List rows.
        rows.forEach(({ row, name, info }, i) => {
          const snake = state.snakes[i];
          row.setProperties({ display: snake ? 'flex' : 'none' });
          if (!snake) return;
          name.setProperties({ text: snake.name });
          info.setProperties({ text: snake.path.length < 2 ? 'empty' : snake.closed ? 'loop' : 'path' });
          rowButtons[i]!.setSelected(snake.id === state.selectedId);
        });
        listEmpty.setProperties({ display: state.snakes.length ? 'none' : 'flex' });
        const selected = selectedSnake(state);
        deleteButton.setDisabled(!selected);
        editButton.setDisabled(!selected);
        addButton.setDisabled(state.snakes.length >= MAX_SNAKES);
        editName.setProperties({ text: selected?.name ?? 'Snake' });
        paramsName.setProperties({ text: selected?.name ?? 'No snake selected' });
        closedToggle.setValue(selected?.closed ?? false);
        const curve = selected ? sampleCurve(selected.path, selected.closed) : null;
        pathInfo.setProperties({
          text: curve ? `${selected!.path.length} points | ${curve.length.toFixed(2)} m | ${selected!.closed ? 'closed loop' : 'open path'}` : 'No path yet: draw one or load a demo shape',
        });
        if (listMenu.visible) syncWindows(true);
      };

      let lastSelectedId: string | null = null;
      const commit = (next: SnakeState) => {
        state = next;
        const selected = selectedSnake(state);
        if (selected && selected.id !== lastSelectedId) loadSettings(selected.look, selected.palette);
        lastSelectedId = selected?.id ?? null;
        render();
      };

      // --- List window ------------------------------------------------------------------------
      const rowButtons = rows.map((_, i) =>
        track(
          bindButton(listPanel, `snake-row-${i}`, {
            ...common,
            onClick: () => {
              const snake = state.snakes[i];
              if (snake) commit(selectSnake(state, snake.id));
            },
          }),
        ),
      );
      const addButton = track(
        bindButton(listPanel, 'btn-add', {
          ...common,
          onClick: () => {
            setTool('draw');
            commit(setEditing(addSnake(state), true));
          },
        }),
      );
      const deleteButton = track(
        bindButton(listPanel, 'btn-delete', { ...common, onClick: () => state.selectedId && commit(deleteSnake(state, state.selectedId)) }),
      );
      const editButton = track(
        bindButton(listPanel, 'btn-edit', {
          ...common,
          onClick: () => {
            const selected = selectedSnake(state);
            setTool(selected && selected.path.length >= 2 ? 'move' : 'draw');
            commit(setEditing(state, true));
          },
        }),
      );

      // --- Edit window ------------------------------------------------------------------------
      const hint = requireElement(editPanel, 'edit-hint');
      const toolButtons = new Map<Tool, ReturnType<typeof bindButton>>();
      const hints: Record<Tool, string> = {
        draw: 'Draw: hold trigger or pinch with your right hand and move through the air. End near the start for a loop.',
        move: 'Move: grab the dots with a ray to reshape. The last one you grabbed is selected (orange); press B to delete it.',
      };
      const setTool = (next: Tool) => {
        tool = next;
        toolButtons.forEach((button, name) => button.setSelected(name === next));
        hint.setProperties({ text: hints[next] });
      };
      for (const name of ['draw', 'move'] as const) {
        toolButtons.set(name, track(bindButton(editPanel, `tool-${name}`, { ...common, onClick: () => setTool(name) })));
      }
      const exitEdit = () => {
        const selected = selectedSnake(state);
        let next = setEditing(state, false);
        // An edit that never drew anything leaves no empty snake behind.
        if (selected && selected.path.length < 2) next = deleteSnake(next, selected.id);
        commit(next);
      };
      track(bindButton(editPanel, 'btn-done', { ...common, onClick: exitEdit }));
      const closedToggle = track(
        bindToggle(editPanel, 'closed', {
          ...common,
          value: false,
          onChange: (closed) => {
            const selected = selectedSnake(state);
            if (selected) commit(setClosed(state, selected.id, closed));
            else closedToggle.setValue(false);
          },
        }),
      );
      const updatePath = (path: Anchor[], closed: boolean) => {
        const selected = selectedSnake(state);
        if (selected) commit(updateSnake(state, selected.id, { path, closed: closed && path.length >= 2 }));
      };
      track(
        bindButton(editPanel, 'btn-add-point', {
          ...common,
          onClick: () => {
            const selected = selectedSnake(state);
            const object = selected && objects.get(selected.id);
            if (!selected || !object || selected.path.length < 2) return;
            const segments = segmentCount(selected.path, selected.closed);
            const segment = object.selectedHandle >= 0 ? Math.min(object.selectedHandle, segments - 1) : Math.floor(segments / 2);
            updatePath(insertAnchor(selected.path, segment, 0.5, selected.closed), selected.closed);
            object.selectHandle(segment + 1);
          },
        }),
      );
      const deleteSelectedPoint = (): boolean => {
        const selected = selectedSnake(state);
        const object = selected && objects.get(selected.id);
        if (!selected || !object || object.selectedHandle < 0) return false;
        updatePath(deleteAnchors(selected.path, new Set([object.selectedHandle])), selected.closed);
        object.selectHandle(-1);
        return true;
      };
      track(bindButton(editPanel, 'btn-delete-point', { ...common, onClick: deleteSelectedPoint }));
      track(bindButton(editPanel, 'btn-demo-loop', { ...common, onClick: () => updatePath(demoLoopPath(), true) }));
      track(bindButton(editPanel, 'btn-demo-wave', { ...common, onClick: () => updatePath(demoWavePath(), false) }));

      // --- Settings window ----------------------------------------------------------------------
      track(bindTabs(paramsPanel, ['shape', 'pattern', 'material', 'motion'].map((n) => ({ tab: `tab-${n}`, page: `page-${n}` })), common));
      const bgSettings = requireElement(paramsPanel, 'bg-settings');
      let loading = false;
      const writeLook = (patch: Partial<SnakeLook>, palette?: string) => {
        const selected = selectedSnake(state);
        if (!selected || loading) return;
        state = updateSnake(state, selected.id, { look: { ...selected.look, ...patch }, ...(palette ? { palette } : {}) });
        objects.get(selected.id)?.setRecord(selectedSnake(state)!);
      };
      for (const id of Object.keys(SNAKE_PARAMS) as ParamId[]) {
        if (BOOLEAN_PARAMS.has(id)) {
          const control = track(bindToggle(paramsPanel, id, { ...common, ...toggleOptions(params, id) }));
          track(bindUI(params, id, control));
        } else {
          const format = id === 'thickness' ? (v: number) => v.toFixed(3) : undefined;
          const control = track(bindSlider(paramsPanel, id, { ...common, ...controlOptions(params, id), step: SLIDER_STEPS[id], format }));
          track(bindUI(params, id, control));
        }
        track(
          params.subscribe(id, (value, source) => {
            // Background colour settings apply only when the gaps are filled (not transparent).
            if (id === 'transparent') bgSettings.setProperties({ display: value >= 0.5 ? 'none' : 'flex' });
            if (source === 'code') return;
            writeLook({ [id]: BOOLEAN_PARAMS.has(id) ? value >= 0.5 : value } as Partial<SnakeLook>);
          }),
        );
      }
      const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
      const choice = <T extends string>(panel: UIKitMLAsset, prefix: string, names: readonly T[], apply: (name: T) => void) => {
        const buttons = names.map((name) =>
          track(bindButton(panel, `${prefix}-${slug(name)}`, { ...common, onClick: () => select(name, true) })),
        );
        const select = (name: T, write: boolean) => {
          buttons.forEach((button, i) => button.setSelected(names[i] === name));
          if (write) apply(name);
        };
        return select;
      };
      const sphereSettings = requireElement(paramsPanel, 'sphere-settings');
      const selectBody = choice(paramsPanel, 'body', ['Tube', 'Spheres'] as const, (name) => {
        writeLook({ body: name === 'Spheres' ? 'spheres' : 'tube' });
        sphereSettings.setProperties({ display: name === 'Spheres' ? 'flex' : 'none' });
      });
      const selectProfile = choice(paramsPanel, 'profile', ['Round', 'Square'] as const, (name) => writeLook({ profile: name === 'Square' ? 4 : 0 }));
      const selectPattern = choice(paramsPanel, 'pattern', ['Solid', 'Rings', 'Hilbert'] as const, (name) =>
        writeLook({ pattern: name.toLowerCase() as SnakePattern }),
      );
      const selectPalette = choice(paramsPanel, 'palette', Object.keys(SNAKE_PALETTES) as SnakePaletteName[], (name) => writeLook({}, name));

      /** Show the selected snake's settings in the controls (no write-back). */
      function loadSettings(look: SnakeLook, palette: string) {
        loading = true;
        const values: Record<string, number> = {};
        for (const id of Object.keys(SNAKE_PARAMS) as ParamId[]) {
          const value = look[id];
          values[id] = typeof value === 'boolean' ? (value ? 1 : 0) : (value as number);
        }
        params.apply(values, 'code');
        selectBody(look.body === 'spheres' ? 'Spheres' : 'Tube', false);
        sphereSettings.setProperties({ display: look.body === 'spheres' ? 'flex' : 'none' });
        selectProfile(look.profile === 4 ? 'Square' : 'Round', false);
        selectPattern((look.pattern.charAt(0).toUpperCase() + look.pattern.slice(1)) as 'Solid' | 'Rings' | 'Hilbert', false);
        selectPalette((palette in SNAKE_PALETTES ? palette : DEFAULT_PALETTE) as SnakePaletteName, false);
        bgSettings.setProperties({ display: look.transparent ? 'none' : 'flex' });
        loading = false;
      }

      // --- Drawing ------------------------------------------------------------------------------
      const strokePositions = new Float32Array(MAX_STROKE_POINTS * 3);
      const strokeGeometry = track(new BufferGeometry());
      strokeGeometry.setAttribute('position', new BufferAttribute(strokePositions, 3));
      strokeGeometry.setDrawRange(0, 0);
      const strokeLine = new Line(strokeGeometry, track(new LineBasicMaterial({ color: theme.colors.secondary })));
      strokeLine.frustumCulled = false;
      track(world.createTransformEntity(strokeLine));
      let stroke: Array<{ world: Point; local: Point }> | undefined;
      const pen = new Vector3();
      const penForward = new Vector3();
      const pointingAtWindow = () => [listEntity, editEntity, paramsEntity].some((e) => e.hasComponent(Hovered));

      const penPosition = (): Vector3 => {
        const { player } = world;
        if (world.input.xr.isPrimary('hand', 'right')) return player.indexTipSpaces.right.getWorldPosition(pen);
        player.raySpaces.right.getWorldPosition(pen);
        player.raySpaces.right.getWorldDirection(penForward);
        return pen.addScaledVector(penForward, -0.06);
      };

      const finishStroke = () => {
        const points = stroke ?? [];
        stroke = undefined;
        strokeGeometry.setDrawRange(0, 0);
        const local = points.map((p) => p.local);
        if (strokeLength(points.map((p) => p.world)) < MIN_STROKE) {
          sounds.play('release');
          return;
        }
        const loop = isLoopStroke(local);
        updatePath(fitPathFromStroke(simplifyStroke(smoothStroke(local, 3), 0.015), { closed: loop }), loop);
        setTool('move');
        haptics.play('right', 'select');
        sounds.play('select');
      };

      const updateDrawing = () => {
        const selected = selectedSnake(state);
        const object = selected && objects.get(selected.id);
        const select = world.input.xr.getSelectState('right');
        if (!stroke) {
          if (state.editing && tool === 'draw' && object && select.start && !pointingAtWindow() && world.input.xr.getPrimaryInputSource('right')) {
            stroke = [];
            haptics.play('right', 'click');
          }
          return;
        }
        if (!select.active || !object) {
          finishStroke();
          return;
        }
        const p = penPosition();
        const point = { x: p.x, y: p.y, z: p.z };
        const last = stroke[stroke.length - 1];
        if ((!last || distance(last.world, point) >= POINT_SPACING) && stroke.length < MAX_STROKE_POINTS) {
          stroke.push({ world: point, local: object.toLocal(p) });
          strokePositions.set([point.x, point.y, point.z], (stroke.length - 1) * 3);
          strokeGeometry.attributes.position!.needsUpdate = true;
          strokeGeometry.setDrawRange(0, stroke.length);
        }
      };

      // --- Start ----------------------------------------------------------------------------------
      setTool('draw');
      commit(addSnake(createSnakeState(), { path: demoLoopPath(), closed: true, name: 'Snake 1' }));

      frame = (dt) => {
        listMenu.update();
        editMenu.update();
        paramsMenu.update();
        updateDrawing();
        // Controller shortcut: B deletes the selected vertex while editing.
        if (state.editing && world.input.xr.gamepads.right?.getButtonDown(InputComponent.B_Button) && deleteSelectedPoint()) {
          haptics.play('right', 'click');
          sounds.play('release');
        }
        for (const object of objects.values()) {
          const dragged = object.update(dt);
          if (dragged) {
            const record = object.record;
            state = updateSnake(state, record.id, { path: moveAnchor(record.path, dragged.index, dragged.point) });
            object.setRecord(state.snakes.find((s) => s.id === record.id)!);
          }
          // Grabbing a snake selects it.
          if (object.grabbed && state.selectedId !== object.id && !state.editing) commit(selectSnake(state, object.id));
        }
        // Twist label: loops use whole turns.
        const selected = selectedSnake(state);
        if (selected?.closed && effectiveTwist(selected.look.twist, true) !== selected.look.twist) twistNote(effectiveTwist(selected.look.twist, true));
        else lastNote = '';
      };
      const twistValue = requireElement(paramsPanel, 'twist-value') as UIElement;
      let lastNote = '';
      const twistNote = (snapped: number) => {
        const text = `${snapped} (loop)`;
        if (text === lastNote) return;
        lastNote = text;
        twistValue.setProperties({ text });
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
