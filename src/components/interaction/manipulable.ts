import {
  createSystem,
  DistanceGrabbable,
  Grabbed,
  GrabSystem,
  MovementMode,
  RayInteractable,
  TwoHandsGrabbable,
  type Entity,
} from '@iwsdk/core';
import type { Hand, Haptics } from './haptics.js';

/**
 * Grab / rotate / scale helper over IWSDK's GrabSystem (PRD §6.3).
 * IWSDK grab components are mutually exclusive per entity, so pick one style:
 * - 'near'     (default) squeeze or pinch close by; one hand moves/rotates, a second hand scales (TwoHandsGrabbable).
 * - 'distance' point and trigger/pinch from afar; also works with the desktop mouse (DistanceGrabbable).
 */
export type ManipulableOptions = {
  grab?: 'near' | 'distance';
  rotate?: boolean;
  /** Allow scaling within bounds (uniform factors). */
  scale?: boolean | { min: number; max: number };
  /** Spring back to the start pose on release (distance only). */
  returnToOrigin?: boolean;
};

const vec3 = (v: number): [number, number, number] => [v, v, v];

export const makeManipulable = (entity: Entity, options: ManipulableOptions = {}): Entity => {
  const { grab = 'near', rotate = true, scale = true, returnToOrigin = false } = options;
  const bounds = typeof scale === 'object' ? scale : { min: 0.25, max: 4 };
  const scaleFields = scale ? { scale: true, scaleMin: vec3(bounds.min), scaleMax: vec3(bounds.max) } : { scale: false };

  if (grab === 'near') {
    entity.addComponent(TwoHandsGrabbable, { rotate, translate: true, ...scaleFields });
  } else {
    if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
    entity.addComponent(DistanceGrabbable, {
      rotate,
      translate: true,
      ...scaleFields,
      movementMode: MovementMode.MoveFromTarget,
      returnToOrigin,
    });
  }
  return entity;
};

/** Plays `grab` / `release` haptics on the holding controller. Register once per world. */
export const createGrabHapticsSystem = (haptics: Haptics) =>
  class GrabHapticsSystem extends createSystem({ held: { required: [Grabbed] } }) {
    private holders = new Map<Entity, Hand>();

    init(): void {
      const grabs = this.world.getSystem(GrabSystem);
      this.cleanupFuncs.push(
        this.queries.held.subscribe('qualify', (entity) => {
          const hand = grabs?.getHolderHand(entity) ?? 'right';
          this.holders.set(entity, hand);
          haptics.play(hand, 'grab');
        }),
        this.queries.held.subscribe('disqualify', (entity) => {
          haptics.play(this.holders.get(entity) ?? 'right', 'release');
          this.holders.delete(entity);
        }),
      );
    }
  };
