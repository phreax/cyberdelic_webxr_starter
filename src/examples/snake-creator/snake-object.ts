import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Grabbed,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TwoHandsGrabbable,
  Vector3,
  type Entity,
} from '@iwsdk/core';
import { makeManipulable } from '../../components/interaction/manipulable.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { crawlAt } from './crawl.js';
import { CURVE_SAMPLES, sampleCurve, type Curve } from './curve.js';
import { SNAKE_PALETTES, type SnakePaletteName } from './gradient.js';
import type { Point } from './path.js';
import type { SnakeRecord } from './snake-model.js';
import { createSnakeRenderer } from './snake-renderer.js';

export type SnakeMode = 'view' | 'edit';

const noRaycast = () => {};

/**
 * Runtime for one snake: a grabbable group (move / rotate with one hand, uniform two-hand scale)
 * holding the GPU-bent snake. In edit mode the snake is hidden and only its curve and vertex
 * handles show. The path lives in the group's local space, so moving / scaling the snake keeps it.
 */
export const createSnakeObject = (ctx: ExperienceContext, initial: SnakeRecord) => {
  const { world, theme } = ctx;
  const root = new Group();
  root.name = initial.id;
  const entity: Entity = world.createTransformEntity(root);

  const renderer = createSnakeRenderer();
  renderer.mesh.raycast = noRaycast; // the unbent grid is not where the snake is
  root.add(renderer.mesh);

  // Invisible grab proxy around the curve.
  const proxyMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const proxy = new Mesh(new BoxGeometry(1, 1, 1), proxyMaterial);
  proxy.name = `${initial.id}-grab`;
  root.add(proxy);

  // Edit view: curve line + vertex handles.
  const curvePositions = new Float32Array(CURVE_SAMPLES * 3);
  const curveGeometry = new BufferGeometry();
  curveGeometry.setAttribute('position', new BufferAttribute(curvePositions, 3));
  const curveMaterial = new LineBasicMaterial({ color: theme.colors.primary });
  const openLine = new Line(curveGeometry, curveMaterial);
  const loopLine = new LineLoop(curveGeometry, curveMaterial);
  for (const line of [openLine, loopLine]) {
    line.raycast = noRaycast;
    line.frustumCulled = false;
    line.visible = false;
    root.add(line);
  }
  const handleGeometry = new SphereGeometry(0.018, 16, 12);
  const handleMaterial = new MeshStandardMaterial({ color: theme.colors.primary, emissive: theme.colors.primary, emissiveIntensity: 0.3, roughness: 0.3 });
  const selectedMaterial = new MeshStandardMaterial({ color: theme.colors.secondary, emissive: theme.colors.secondary, emissiveIntensity: 0.6, roughness: 0.3 });
  let handles: Entity[] = [];

  let record = initial;
  let curve: Curve | null = null;
  let mode: SnakeMode = 'view';
  let selectedHandle = -1;
  let clock = 0;
  const temp = new Vector3();

  const setGrabbable = (on: boolean) => {
    const has = entity.hasComponent(TwoHandsGrabbable);
    if (on && !has) makeManipulable(entity, { grab: 'near', scale: { min: 0.2, max: 5 } });
    if (!on && has) entity.removeComponent(TwoHandsGrabbable);
  };

  const rebuildCurve = () => {
    curve = sampleCurve(record.path, record.closed);
    renderer.setCurve(curve);
    if (!curve) {
      proxy.visible = false;
      return;
    }
    // Curve positions (row 0) for the edit line and the grab proxy bounds.
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < CURVE_SAMPLES; i += 1) {
      for (let c = 0; c < 3; c += 1) {
        const v = curve.data[i * 4 + c]!;
        curvePositions[i * 3 + c] = v;
        min[c] = Math.min(min[c]!, v);
        max[c] = Math.max(max[c]!, v);
      }
    }
    curveGeometry.attributes.position!.needsUpdate = true;
    const margin = record.look.thickness * 2 + 0.02;
    proxy.position.set((min[0]! + max[0]!) / 2, (min[1]! + max[1]!) / 2, (min[2]! + max[2]!) / 2);
    proxy.scale.set(max[0]! - min[0]! + margin, max[1]! - min[1]! + margin, max[2]! - min[2]! + margin);
    proxy.visible = mode === 'view';
  };

  const clearHandles = () => {
    handles.forEach((handle) => handle.dispose());
    handles = [];
  };

  const buildHandles = () => {
    clearHandles();
    if (mode !== 'edit') return;
    handles = record.path.map((anchor, i) => {
      const mesh = new Mesh(handleGeometry, i === selectedHandle ? selectedMaterial : handleMaterial);
      mesh.position.set(anchor.point.x, anchor.point.y, anchor.point.z);
      const handle = world.createTransformEntity(mesh, { parent: entity });
      return makeManipulable(handle, { grab: 'distance', rotate: false, scale: false });
    });
  };

  const applyMode = () => {
    const editing = mode === 'edit';
    renderer.mesh.visible = !editing && curve !== null;
    openLine.visible = editing && curve !== null && !record.closed;
    loopLine.visible = editing && curve !== null && record.closed;
    proxy.visible = !editing && curve !== null;
    setGrabbable(!editing);
    buildHandles();
  };

  const object = {
    id: initial.id,
    entity,
    root,
    get record() {
      return record;
    },
    get selectedHandle() {
      return selectedHandle;
    },
    /** True while the user holds the snake (used to select it by grabbing). */
    get grabbed() {
      return entity.hasComponent(Grabbed);
    },
    setRecord(next: SnakeRecord) {
      const pathChanged = next.path !== record.path || next.closed !== record.closed;
      const countChanged = next.path.length !== record.path.length;
      record = next;
      renderer.setGradient(SNAKE_PALETTES[(next.palette as SnakePaletteName) in SNAKE_PALETTES ? (next.palette as SnakePaletteName) : 'Cyberdelic']);
      if (pathChanged) rebuildCurve();
      if (countChanged || pathChanged) {
        if (selectedHandle >= next.path.length) selectedHandle = -1;
        if (mode === 'edit' && countChanged) buildHandles();
      }
      applyModeVisibility();
    },
    setMode(next: SnakeMode) {
      if (next === mode) return;
      mode = next;
      if (next === 'view') selectedHandle = -1;
      applyMode();
    },
    selectHandle(index: number) {
      selectedHandle = index;
      handles.forEach((h, i) => ((h.object3D as Mesh).material = i === index ? selectedMaterial : handleMaterial));
    },
    /** World point → snake-local point (for drawing). */
    toLocal(world: Vector3): Point {
      root.updateWorldMatrix(true, false);
      const p = root.worldToLocal(temp.copy(world));
      return { x: p.x, y: p.y, z: p.z };
    },
    /**
     * Per frame. Returns the index + local position of a vertex handle being dragged, if any,
     * so the experience can update the path through the model.
     */
    update(dt: number): { index: number; point: Point } | undefined {
      clock += dt * record.look.speed;
      renderer.apply(record.look, crawlAt(clock, { speed: 1, length: record.look.length, closed: record.closed, reverse: record.look.reverse }));
      if (mode !== 'edit') return undefined;
      let dragged: { index: number; point: Point } | undefined;
      handles.forEach((handle, i) => {
        const mesh = handle.object3D!;
        const anchor = record.path[i]?.point;
        if (!anchor) return;
        if (handle.hasComponent(Grabbed)) {
          if (selectedHandle !== i) object.selectHandle(i);
          mesh.getWorldPosition(temp);
          const local = object.toLocal(temp);
          if (Math.abs(local.x - anchor.x) + Math.abs(local.y - anchor.y) + Math.abs(local.z - anchor.z) > 1e-4) dragged = { index: i, point: local };
        } else if (mesh.parent === root) {
          mesh.position.set(anchor.x, anchor.y, anchor.z);
        }
      });
      return dragged;
    },
    dispose() {
      clearHandles();
      renderer.dispose();
      handleGeometry.dispose();
      handleMaterial.dispose();
      selectedMaterial.dispose();
      curveGeometry.dispose();
      curveMaterial.dispose();
      proxy.geometry.dispose();
      proxyMaterial.dispose();
      entity.dispose();
    },
  };

  // Lightweight visibility refresh after record changes (no handle rebuild).
  const applyModeVisibility = () => {
    const editing = mode === 'edit';
    renderer.mesh.visible = !editing && curve !== null;
    openLine.visible = editing && curve !== null && !record.closed;
    loopLine.visible = editing && curve !== null && record.closed;
    proxy.visible = !editing && curve !== null;
  };

  renderer.setGradient(SNAKE_PALETTES.Cyberdelic);
  rebuildCurve();
  applyMode();
  return object;
};

export type SnakeObject = ReturnType<typeof createSnakeObject>;
