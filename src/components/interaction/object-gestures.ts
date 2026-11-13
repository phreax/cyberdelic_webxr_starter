import { Hovered, Matrix4, Quaternion, Vector3, type Entity } from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { oneHandTransformDelta, twoHandGesture } from './hand-gestures.js';

/**
 * Hand gestures for a bounded object (e.g. a raymarched sphere):
 * - both hands pinching (or triggers): zoom (bounded) + rotate,
 * - right hand: move + rotate the object as if holding it,
 * - left hand: drag to change a parameter (right / up increases).
 * A pinch engages near the object or when its target ray passes through the gesture sphere.
 * The render proxy stays out of IWSDK pointer targets so it cannot block menus.
 */
export type ObjectGestureOptions = {
  /** Object-space radius of the grabbable volume (scaled by the object's world scale). */
  radius?: number;
  zoom?: readonly [number, number];
  /** Parameter change per metre of left-hand drag. */
  gain?: number;
  onParameterDrag?: (delta: number) => void;
  /** Suspend object transforms while another interaction mode owns hand pinches. */
  disabled?: () => boolean;
  ignore?: readonly Entity[];
};

type Hand = 'left' | 'right';
const HANDS: readonly Hand[] = ['left', 'right'];

export const rayIntersectsGestureSphere = (origin: Vector3, direction: Vector3, center: Vector3, radius: number) => {
  const x = center.x - origin.x;
  const y = center.y - origin.y;
  const z = center.z - origin.z;
  const along = x * direction.x + y * direction.y + z * direction.z;
  return along >= 0 && x * x + y * y + z * z - along * along <= radius * radius;
};

export const createObjectGestures = (ctx: ExperienceContext, entity: Entity, options: ObjectGestureOptions = {}) => {
  const { world, haptics } = ctx;
  const { radius = 1, zoom = [0.3, 4], gain = 1.5, onParameterDrag, disabled, ignore = [] } = options;
  const object = entity.object3D!;
  const baseScale = object.scale.x;
  const engaged: Record<Hand, boolean> = { left: false, right: false };
  const previous: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  const current: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  const center = new Vector3();
  const worldScale = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const axis = new Vector3();
  const delta = new Vector3();
  const rotation = new Quaternion();
  // Right-hand hold: object pose relative to the hand when the hold started.
  const holdOffset = new Matrix4();
  const handMatrix = new Matrix4();
  const target = new Matrix4();
  const parentInverse = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const rayOrigin = new Vector3();
  const rayDirection = new Vector3();
  const rayRotation = new Quaternion();
  let holding = false;
  const tuple = (v: Vector3) => [v.x, v.y, v.z] as const;

  const handPosition = (hand: Hand, out: Vector3) =>
    world.input.xr.isPrimary('hand', hand) ? world.player.indexTipSpaces[hand].getWorldPosition(out) : world.player.gripSpaces[hand].getWorldPosition(out);

  const pointsAtObject = (hand: Hand, reach: number) => {
    const raySpace = world.player.raySpaces[hand];
    raySpace.getWorldPosition(rayOrigin);
    raySpace.getWorldQuaternion(rayRotation);
    rayDirection.set(0, 0, -1).applyQuaternion(rayRotation);
    return rayIntersectsGestureSphere(rayOrigin, rayDirection, center, reach);
  };


  const startHold = () => {
    world.player.gripSpaces.right.updateWorldMatrix(true, false);
    object.updateWorldMatrix(true, false);
    holdOffset.copy(world.player.gripSpaces.right.matrixWorld).invert().multiply(object.matrixWorld);
    holding = true;
  };

  return {
    /** True while any hand holds the object. */
    get active() {
      return engaged.left || engaged.right;
    },
    update(): void {
      if (disabled?.()) {
        engaged.left = false;
        engaged.right = false;
        holding = false;
        for (const hand of HANDS) {
          if (world.input.xr.getPrimaryInputSource(hand)) handPosition(hand, previous[hand]);
        }
        return;
      }
      object.getWorldPosition(center);
      object.getWorldScale(worldScale);
      const reach = radius * worldScale.x * 1.2;
      const pointingAtMenu = ignore.some((e) => e.hasComponent(Hovered));
      for (const hand of HANDS) {
        if (!world.input.xr.getPrimaryInputSource(hand)) {
          engaged[hand] = false;
          continue;
        }
        handPosition(hand, current[hand]);
        const select = world.input.xr.getSelectState(hand);
        const near = current[hand].distanceTo(center) < reach;
        const aimedByController = !world.input.xr.isPrimary('hand', hand) && pointsAtObject(hand, reach);
        if (select.start && !pointingAtMenu && (near || aimedByController)) {
          engaged[hand] = true;
          haptics.play(hand, 'grab');
        }
        if (!select.active && engaged[hand]) {
          engaged[hand] = false;
          haptics.play(hand, 'release');
        }
      }

      if (engaged.left && engaged.right) {
        holding = false;
        const g = twoHandGesture(tuple(previous.left), tuple(previous.right), tuple(current.left), tuple(current.right));
        object.scale.setScalar(Math.min(baseScale * zoom[1], Math.max(baseScale * zoom[0], object.scale.x * g.scale)));
        if (g.angle > 0) object.quaternion.premultiply(rotation.setFromAxisAngle(axis.set(...g.axis), g.angle));
      } else if (engaged.right) {
        // Hold: the object follows the hand's position and rotation, keeping its own scale.
        if (!holding) startHold();
        world.player.gripSpaces.right.updateWorldMatrix(true, false);
        handMatrix.copy(world.player.gripSpaces.right.matrixWorld);
        target.multiplyMatrices(handMatrix, holdOffset);
        if (object.parent) target.premultiply(parentInverse.copy(object.parent.matrixWorld).invert());
        target.decompose(position, quaternion, scale);
        object.position.copy(position);
        object.quaternion.copy(quaternion);
      } else {
        holding = false;
        if (engaged.left && onParameterDrag) {
          world.camera.matrixWorld.extractBasis(right, up, axis);
          delta.subVectors(current.left, previous.left);
          const change = oneHandTransformDelta(tuple(delta), tuple(right), tuple(up), gain);
          if (change !== 0) onParameterDrag(change);
        }
      }
      for (const hand of HANDS) previous[hand].copy(current[hand]);
    },
  };
};
