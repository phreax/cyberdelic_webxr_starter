// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DepthOccludable,
  Grabbed,
  GrabSystem,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TwoHandsGrabbable,
  Vector3,
  type Entity,
  type CubeTexture,
} from '@iwsdk/core';
import { makeManipulable } from '../../components/interaction/manipulable.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { crawlAt } from './crawl.js';
import { CURVE_SAMPLES, sampleCurve, type Curve } from './curve.js';
import { SNAKE_PALETTES, type SnakePaletteName } from './gradient.js';
import type { Point } from './path.js';
import type { SnakeRecord, SnakeTransform } from './snake-model.js';
import { createSnakeRenderer } from './snake-renderer.js';
import { snakeBody } from './body-registry.js';
import type { SnakeBodyLayer, SnakeBodyLayerOptions } from './body-plugin.js';
import type { SnakeLook } from './snake-look.js';
import { isNearSnakeCurve } from './snake-grab.js';

export type SnakeMode = 'view' | 'edit';

const noRaycast = () => {};

export type SnakeBodyFactory = (options: SnakeBodyLayerOptions) => SnakeBodyLayer;
const paletteStops = (name: string) => SNAKE_PALETTES[(name as SnakePaletteName) in SNAKE_PALETTES ? (name as SnakePaletteName) : 'Ethereal Garden'];
/** Bounds / grab reach of a look, in snake thicknesses (plug-in bodies may reach further than the tube). */
const bodyReach = (look: SnakeLook) => snakeBody(look.body)?.reach?.(look) ?? 2;

/**
 * Runtime for one snake: a grabbable group (move / rotate with one hand, uniform two-hand scale)
 * holding the GPU-bent snake. In edit mode the snake is hidden and only its curve and vertex
 * handles show. The path lives in the group's local space, so moving / scaling the snake keeps it.
 */
export const createSnakeObject = (
  ctx: ExperienceContext,
  initial: SnakeRecord,
  environment: CubeTexture | null = null,
  bodyFactories: ReadonlyMap<string, SnakeBodyFactory> = new Map(),
) => {
  const { world, theme } = ctx;
  const root = new Group();
  root.name = initial.id;
  if (initial.transform) {
    root.position.fromArray(initial.transform.position);
    root.quaternion.fromArray(initial.transform.quaternion);
    root.scale.setScalar(initial.transform.scale);
  }
  const entity: Entity = world.createTransformEntity(root);
  const grabRoot = new Group();
  grabRoot.name = `${initial.id}-grab-target`;
  grabRoot.position.copy(root.position);
  grabRoot.quaternion.copy(root.quaternion);
  grabRoot.scale.copy(root.scale);
  const grabEntity = world.createTransformEntity(grabRoot);

  const renderer = createSnakeRenderer(environment);
  renderer.mesh.raycast = noRaycast; // the unbent grid is not where the snake is
  const primary = new Group();
  primary.name = 'snake-primary';
  root.add(primary);
  const primaryEntity = world.createTransformEntity(primary, { parent: entity });
  primary.add(renderer.mesh, renderer.halo);
  // Depth sensing updates materials, not transforms. Register each shared material
  // once: the mirrored meshes reuse these same materials and uniforms.
  const bodyEntity = world.createTransformEntity(renderer.mesh, { parent: primaryEntity });
  const haloEntity = world.createTransformEntity(renderer.halo, { parent: primaryEntity });
  bodyEntity.addComponent(DepthOccludable);
  haloEntity.addComponent(DepthOccludable);
  const mirror = new Group();
  mirror.name = 'snake-mirror-yz';
  mirror.scale.x = -1;
  root.add(mirror);
  const mirrorEntity = world.createTransformEntity(mirror, { parent: entity });
  const mirrorBody = new Mesh(renderer.mesh.geometry, renderer.mesh.material);
  mirrorBody.renderOrder = 1;
  const mirrorHalo = new Mesh(renderer.halo.geometry, renderer.halo.material);
  mirrorBody.frustumCulled = false;
  mirrorHalo.frustumCulled = false;
  mirrorHalo.renderOrder = 2;
  mirrorBody.raycast = noRaycast;
  mirrorHalo.raycast = noRaycast;
  mirror.add(mirrorBody, mirrorHalo);
  mirror.visible = false;
  const depthUniforms = (renderer.mesh.material as ShaderMaterial).uniforms;
  // Plug-in body layers (see body-plugin.ts), keyed by body id. Created when their resources load.
  const layers = new Map<string, { layer: SnakeBodyLayer; entities: Entity[] }>();
  const addLayer = (id: string, factory: SnakeBodyFactory) => {
    if (layers.has(id)) return;
    const layer = factory({ environment, depthUniforms });
    const entities = [world.createTransformEntity(layer.mesh, { parent: primaryEntity })];
    // Mirror meshes share the layer's material, which already reads the live depth uniforms.
    if (layer.mirrorMesh) entities.push(world.createTransformEntity(layer.mirrorMesh, { parent: mirrorEntity }));
    layer.setCurve(curve);
    layer.setPalette(paletteStops(record.palette));
    layer.setWarmth(globalWarmth);
    layers.set(id, { layer, entities });
    applyModeVisibility();
  };
  let globalWarmth = 0.5;

  // Invisible grab proxy around the curve.
  const proxyMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const proxy = new Mesh(new BoxGeometry(1, 1, 1), proxyMaterial);
  proxy.name = `${initial.id}-grab`;
  grabRoot.add(proxy);

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
  const handleMaterial = new MeshStandardMaterial({ color: theme.colors.primary, emissive: theme.colors.primary, emissiveIntensity: 0.3, roughness: 0.3, depthTest: false, depthWrite: false });
  const selectedMaterial = new MeshStandardMaterial({ color: theme.colors.secondary, emissive: theme.colors.secondary, emissiveIntensity: 0.6, roughness: 0.3, depthTest: false, depthWrite: false });
  let handles: Entity[] = [];

  let record = initial;
  let curve: Curve | null = null;
  let mode: SnakeMode = 'view';
  let selectedHandle = -1;
  let clock = 0;
  const temp = new Vector3();
  const grabSystem = world.getSystem(GrabSystem);
  let wasNativeGrab = false;

  const setGrabbable = (on: boolean) => {
    const has = grabEntity.hasComponent(TwoHandsGrabbable);
    if (on && !has) makeManipulable(grabEntity, { grab: 'near', scale: { min: 0.2, max: 5 } });
    if (!on && has) {
      if (grabEntity.hasComponent(Grabbed)) grabSystem?.forceRelease(grabEntity);
      grabEntity.removeComponent(TwoHandsGrabbable);
      wasNativeGrab = false;
    }
  };

  const rebuildCurve = () => {
    curve = sampleCurve(record.path, record.closed);
    renderer.setCurve(curve);
    for (const { layer } of layers.values()) layer.setCurve(curve);
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
    const margin = record.look.thickness * Math.max(2, bodyReach(record.look)) + 0.02;
    const separation = record.look.mirror ? record.look.mirrorDistance * .5 : 0;
    const minX = record.look.mirror ? Math.min(min[0]! + separation, -max[0]! - separation) : min[0]!;
    const maxX = record.look.mirror ? Math.max(max[0]! + separation, -min[0]! - separation) : max[0]!;
    proxy.position.set((minX + maxX) / 2, (min[1]! + max[1]!) / 2, (min[2]! + max[2]!) / 2);
    proxy.scale.set(maxX - minX + margin, max[1]! - min[1]! + margin, max[2]! - min[2]! + margin);
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
      mesh.renderOrder = 100;
      mesh.position.set(anchor.point.x, anchor.point.y, anchor.point.z);
      const handle = world.createTransformEntity(mesh, { parent: entity });
      handle.addComponent(DepthOccludable);
      return makeManipulable(handle, { grab: 'distance', rotate: false, scale: false });
    });
  };

  const applyMode = () => {
    const editing = mode === 'edit';
    renderer.mesh.visible = !editing && curve !== null;
    renderer.halo.visible = !editing && curve !== null && !!snakeBody(record.look.body)?.core?.glow && record.look.glow > 0;
    for (const [id, { layer }] of layers) layer.setVisible(!editing && curve !== null && record.look.body === id);
    primary.position.x = record.look.mirror ? record.look.mirrorDistance * .5 : 0;
    mirror.position.x = -record.look.mirrorDistance * .5;
    mirror.visible = record.look.mirror && !editing && curve !== null;
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
      return grabEntity.hasComponent(Grabbed);
    },
    cancelGrab() {
      if (grabEntity.hasComponent(Grabbed)) grabSystem?.forceRelease(grabEntity);
      wasNativeGrab = false;
    },
    setEnvironmentWarmth(value: number) {
      globalWarmth = value;
      renderer.setEnvironmentWarmth(value);
      for (const { layer } of layers.values()) layer.setWarmth(value);
    },
    /** A plug-in body finished loading: draw it for this snake too. */
    addBodyLayer: addLayer,
    setRecord(next: SnakeRecord) {
      const pathChanged = next.path !== record.path || next.closed !== record.closed;
      const countChanged = next.path.length !== record.path.length;
      const previousMirror = record.look.mirror;
      const previousMirrorDistance = record.look.mirrorDistance;
      const previousReach = bodyReach(record.look);
      const previousBody = record.look.body;
      record = next;
      renderer.setGradient(paletteStops(next.palette));
      for (const { layer } of layers.values()) layer.setPalette(paletteStops(next.palette));
      if (pathChanged || next.look.mirror !== previousMirror || next.look.mirrorDistance !== previousMirrorDistance || bodyReach(next.look) !== previousReach || next.look.body !== previousBody) rebuildCurve();
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
    /** Current placement (after grabbing / resizing), for saving. */
    readTransform(): SnakeTransform {
      return {
        position: root.position.toArray() as SnakeTransform['position'],
        quaternion: root.quaternion.toArray() as SnakeTransform['quaternion'],
        scale: root.scale.x,
      };
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
      let grabbed = grabEntity.hasComponent(Grabbed);
      if (grabbed && !wasNativeGrab && curve) {
        const hand = grabSystem?.getHolderHand(grabEntity) ?? 'right';
        const space = world.input.xr.isPrimary('hand', hand) ? world.player.indexTipSpaces[hand] : world.player.gripSpaces[hand];
        space.getWorldPosition(temp);
        grabRoot.updateWorldMatrix(true, false);
        grabRoot.worldToLocal(temp);
        const radius = Math.max(0.1, record.look.thickness * Math.max(3, bodyReach(record.look)));
        if (!isNearSnakeCurve(curve, temp, radius, record.look.mirror ? record.look.mirrorDistance : null)) {
          grabSystem?.forceRelease(grabEntity);
          grabbed = false;
        }
      }
      wasNativeGrab = grabbed;
      if (grabbed) {
        root.position.copy(grabRoot.position);
        root.quaternion.copy(grabRoot.quaternion);
        root.scale.copy(grabRoot.scale);
      } else {
        grabRoot.position.copy(root.position);
        grabRoot.quaternion.copy(root.quaternion);
        grabRoot.scale.copy(root.scale);
      }
      clock += dt * record.look.speed;
      const crawl = crawlAt(clock, { speed: 1, length: record.look.length, closed: record.closed, reverse: record.look.reverse });
      renderer.apply(record.look, crawl, snakeBody(record.look.body)?.core);
      mirrorBody.geometry = renderer.mesh.geometry;
      mirrorBody.visible = renderer.mesh.visible;
      mirrorHalo.visible = renderer.halo.visible;
      if (mode !== 'edit') for (const { layer } of layers.values()) layer.update(record.look, crawl);
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
      if (grabEntity.hasComponent(Grabbed)) grabSystem?.forceRelease(grabEntity);
      for (const { layer, entities } of layers.values()) { entities.forEach((e) => e.dispose()); layer.dispose(); }
      layers.clear();
      bodyEntity.dispose();
      haloEntity.dispose();
      primaryEntity.dispose();
      mirrorEntity.dispose();
      grabEntity.dispose();
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
    renderer.halo.visible = !editing && curve !== null && !!snakeBody(record.look.body)?.core?.glow && record.look.glow > 0;
    for (const [id, { layer }] of layers) layer.setVisible(!editing && curve !== null && record.look.body === id);
    primary.position.x = record.look.mirror ? record.look.mirrorDistance * .5 : 0;
    mirror.position.x = -record.look.mirrorDistance * .5;
    mirror.visible = record.look.mirror && !editing && curve !== null;
    openLine.visible = editing && curve !== null && !record.closed;
    loopLine.visible = editing && curve !== null && record.closed;
    proxy.visible = !editing && curve !== null;
  };

  renderer.setGradient(paletteStops(initial.palette));
  rebuildCurve();
  applyMode();
  for (const [id, factory] of bodyFactories) addLayer(id, factory);
  return object;
};

export type SnakeObject = ReturnType<typeof createSnakeObject>;
