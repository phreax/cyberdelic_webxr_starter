import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

/**
 * Developer Playground props (PRD §12.3): one simple object per interaction component.
 * Standard materials so InteractionHighlight can tint them. Origins are object centres.
 */
const material = (color: string, roughness = 0.35, metalness = 0.1) => new MeshStandardMaterial({ color, roughness, metalness });
const wrap = (...meshes: Mesh[]) => {
  const group = new Group();
  group.add(...meshes);
  return group;
};

/** Rotatable */
export const createPlaygroundCube = () => wrap(new Mesh(new BoxGeometry(0.14, 0.14, 0.14), material('#00d9c7')));
/** Scalable */
export const createPlaygroundGem = () => wrap(new Mesh(new OctahedronGeometry(0.09, 0), material('#ff9500', 0.25, 0.3)));
/** Draggable along x, with its rail */
export const createPlaygroundSlider = () => {
  const knob = new Mesh(new SphereGeometry(0.035, 24, 16), material('#f1f7f5'));
  return wrap(knob);
};
export const createPlaygroundRail = () => {
  const rail = new Mesh(new CylinderGeometry(0.006, 0.006, 0.6, 12).rotateZ(Math.PI / 2), material('#2a3d3b', 0.6));
  return wrap(rail);
};
/** ProximityTrigger zone marker */
export const createPlaygroundBell = () => {
  const ring = new Mesh(new TorusGeometry(0.08, 0.008, 12, 48), material('#9baeab', 0.5));
  const core = new Mesh(new IcosahedronGeometry(0.03, 2), material('#9baeab', 0.4));
  return wrap(ring, core);
};
/** GazeTrigger target */
export const createPlaygroundGazeOrb = () => wrap(new Mesh(new SphereGeometry(0.07, 32, 24), material('#152322', 0.3)));
/** PinchTrigger / press button (also the spatial sound emitter) */
export const createPlaygroundButton = () => {
  const base = new Mesh(new CylinderGeometry(0.06, 0.065, 0.02, 32), material('#152322', 0.6));
  const cap = new Mesh(new CylinderGeometry(0.045, 0.045, 0.02, 32), material('#ff9500', 0.3));
  cap.position.y = 0.018;
  return wrap(base, cap);
};
