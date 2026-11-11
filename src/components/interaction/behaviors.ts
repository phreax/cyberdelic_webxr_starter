import {
  Grabbed,
  Hovered,
  Mesh,
  MeshStandardMaterial,
  OneHandGrabbable,
  Pressed,
  RayInteractable,
  TwoHandsGrabbable,
  Vector3,
  type Entity,
  type Object3D,
} from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { axisConstraint, createGazeDwell, createProximityState } from './triggers.js';

/**
 * PRD §6.3 interaction components as small helpers over IWSDK. Each returns a disposer;
 * per-frame work is registered with `ctx.onFrame`, so experiences don't have to call update.
 */

/** Rotate in place with one hand (squeeze / pinch). */
export const makeRotatable = (entity: Entity) =>
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: false });

/** Resize in place with two hands. */
export const makeScalable = (entity: Entity, { min = 0.25, max = 4 } = {}) =>
  entity.addComponent(TwoHandsGrabbable, {
    rotate: false,
    translate: false,
    scale: true,
    scaleMin: [min, min, min],
    scaleMax: [max, max, max],
  });

/** Move along one local axis within ±range of the start position. */
export const makeDraggable = (entity: Entity, { axis = 'x' as 'x' | 'y' | 'z', range = 0.3 } = {}) => {
  const p = entity.object3D!.position;
  return entity.addComponent(OneHandGrabbable, { rotate: false, translate: true, ...axisConstraint([p.x, p.y, p.z], axis, range) });
};

/** Fires `onPress` when the entity is selected by ray, pinch or mouse (rising edge). */
export const createPressTrigger = (ctx: ExperienceContext, entity: Entity, onPress: () => void) => {
  if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
  let was = false;
  return ctx.onFrame(() => {
    const pressed = entity.hasComponent(Pressed);
    if (pressed && !was) onPress();
    was = pressed;
  });
};

/** PinchTrigger is a press trigger driven by hand pinch (and controller trigger / mouse). */
export const createPinchTrigger = createPressTrigger;

/** Enter/exit when either hand (index fingertip) comes within `radius` of the entity. */
export const createProximityTrigger = (
  ctx: ExperienceContext,
  entity: Entity,
  { radius = 0.15, hysteresis = 0.03, onEnter = () => {}, onExit = () => {} }: {
    radius?: number;
    hysteresis?: number;
    onEnter?: (hand: 'left' | 'right') => void;
    onExit?: () => void;
  },
) => {
  const state = createProximityState({ radius, hysteresis });
  const target = new Vector3();
  const tip = new Vector3();
  const { indexTipSpaces } = ctx.world.player;
  return ctx.onFrame(() => {
    entity.object3D!.getWorldPosition(target);
    const left = indexTipSpaces.left.getWorldPosition(tip).distanceTo(target);
    const right = indexTipSpaces.right.getWorldPosition(tip).distanceTo(target);
    const event = state.update(Math.min(left, right));
    if (event === 'enter') onEnter(left < right ? 'left' : 'right');
    else if (event === 'exit') onExit();
  });
};

/** Fires after the viewer looks at the entity for `dwell` seconds. `onProgress` drives a fill indicator. */
export const createGazeTrigger = (
  ctx: ExperienceContext,
  entity: Entity,
  { dwell = 1.2, angleDeg = 6, onTrigger, onProgress }: {
    dwell?: number;
    angleDeg?: number;
    onTrigger: () => void;
    onProgress?: (progress: number) => void;
  },
) => {
  const gaze = createGazeDwell({ dwell, angle: (angleDeg * Math.PI) / 180 });
  const head = new Vector3();
  const forward = new Vector3();
  const toTarget = new Vector3();
  return ctx.onFrame((dt) => {
    const camera = ctx.world.camera;
    camera.getWorldPosition(head);
    camera.getWorldDirection(forward);
    entity.object3D!.getWorldPosition(toTarget).sub(head).normalize();
    if (gaze.update(forward.angleTo(toTarget), dt)) onTrigger();
    onProgress?.(gaze.progress);
  });
};

/**
 * Visual feedback while hovered: slight relative scale-up and emissive tint (standard materials).
 * Scale is applied relative to the current scale, so grab-scaling is never undone.
 */
export const createInteractionHighlight = (
  ctx: ExperienceContext,
  entity: Entity,
  { scale = 1.06, color = (): string => ctx.theme.colors.primary, intensity = 0.35 }: {
    scale?: number;
    color?: string | (() => string);
    intensity?: number;
  } = {},
) => {
  const object: Object3D = entity.object3D!;
  const tint = typeof color === 'function' ? color : () => color;
  const materials: MeshStandardMaterial[] = [];
  object.traverse((child) => {
    if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) materials.push(child.material);
  });
  const baseEmissive = materials.map((m) => ({ color: m.emissive.clone(), intensity: m.emissiveIntensity }));
  let highlighted = false;
  if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
  const set = (on: boolean) => {
    if (on === highlighted) return;
    highlighted = on;
    object.scale.multiplyScalar(on ? scale : 1 / scale);
    materials.forEach((m, i) => {
      if (on) {
        m.emissive.set(tint());
        m.emissiveIntensity = intensity;
      } else {
        m.emissive.copy(baseEmissive[i]!.color);
        m.emissiveIntensity = baseEmissive[i]!.intensity;
      }
    });
  };
  const off = ctx.onFrame(() => set(entity.hasComponent(Hovered) && !entity.hasComponent(Grabbed)));
  return () => {
    off();
    set(false);
  };
};
