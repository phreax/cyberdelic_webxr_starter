// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { FrontSide, ShaderMaterial, SkinnedMesh, Vector2, type Material, type Object3D, type World } from '@iwsdk/core';
import vertexShader from './patterned-hand.vert.glsl?raw';
import fragmentShader from './patterned-hand.frag.glsl?raw';
import patternSource from './patterned-vision-pattern.glsl?raw';

export const patternedVisionFragment = (source: string) => source.replace('__PATTERNED_VISION_GLSL__', patternSource);

export type HandAppearanceState = {
  outlines: boolean;
  patterned: boolean;
  roomPatterned: boolean;
  scale: number;
  roomScale: number;
  warpAmount: number;
  positionX: number;
  positionY: number;
  alpha: number;
  roomAlpha: number;
  chromaAmount: number;
  fingerLength: number;
};

const states = new WeakMap<World, HandAppearanceState>();
export const handAppearanceState = (world: World): HandAppearanceState => {
  let state = states.get(world);
  if (!state) {
    state = { outlines: true, patterned: false, roomPatterned: false, scale: 1, roomScale: 0, warpAmount: 0, positionX: 0, positionY: 0, alpha: .4, roomAlpha: .2, chromaAmount: .008, fingerLength: 1.08 };
    states.set(world, state);
  }
  return state;
};

const HANDS = ['left', 'right'] as const;
type Slot = { model?: Object3D; mesh?: SkinnedMesh; original?: Material; outlineVisible?: boolean; stencil?: SkinnedMesh; stencilVisible?: boolean };
const findHandMeshes = (model: Object3D) => {
  let outline: SkinnedMesh | undefined;
  let stencil: SkinnedMesh | undefined;
  model.traverse((child) => {
    if (!(child instanceof SkinnedMesh) || !(child.material instanceof ShaderMaterial)) return;
    if ('outlineColor' in child.material.uniforms) outline = child;
    if ('outlineThickness' in child.material.uniforms) stencil = child;
  });
  return { outline, stencil };
};

export const createPatternedHands = (world: World) => {
  const state = handAppearanceState(world);
  const material = new ShaderMaterial({
    name: 'patterned-vision-hand',
    vertexShader,
    fragmentShader: patternedVisionFragment(fragmentShader),
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: state.scale },
      uWarpAmount: { value: state.warpAmount },
      uPosition: { value: new Vector2(state.positionX, state.positionY) },
      uAlpha: { value: state.alpha },
      uChromaAmount: { value: state.chromaAmount },
      uFingerLength: { value: state.fingerLength },
    },
    side: FrontSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const slots: Record<'left' | 'right', Slot> = { left: {}, right: {} };
  // Keep the SDK visual adapters updating hand joints even when their meshes are hidden.
  world.input.xr.visualAdapters.hand.left.toggleVisual(true);
  world.input.xr.visualAdapters.hand.right.toggleVisual(true);
  let time = 0;
  const restore = (slot: Slot) => {
    if (slot.mesh && slot.original && slot.mesh.material === material) slot.mesh.material = slot.original;
    if (slot.mesh) slot.mesh.visible = slot.outlineVisible ?? true;
    if (slot.stencil) slot.stencil.visible = slot.stencilVisible ?? true;
    slot.mesh = undefined;
    slot.original = undefined;
    slot.outlineVisible = undefined;
    slot.stencil = undefined;
    slot.stencilVisible = undefined;
  };
  return {
    state,
    update(dt: number) {
      time += dt;
      material.uniforms.uTime!.value = time;
      material.uniforms.uScale!.value = state.scale;
      material.uniforms.uWarpAmount!.value = state.warpAmount;
      (material.uniforms.uPosition!.value as Vector2).set(state.positionX, state.positionY);
      material.uniforms.uAlpha!.value = state.alpha;
      material.uniforms.uChromaAmount!.value = state.chromaAmount;
      material.uniforms.uFingerLength!.value = state.fingerLength;
      for (const hand of HANDS) {
        const slot = slots[hand];
        const model = world.input.xr.visualAdapters.hand[hand].visual?.model;
        if (slot.model !== model) {
          restore(slot);
          slot.model = model;
        }
        if (model && !slot.mesh) {
          const found = findHandMeshes(model);
          slot.mesh = found.outline;
          slot.original = slot.mesh?.material as Material | undefined;
          slot.outlineVisible = slot.mesh?.visible;
          slot.stencil = found.stencil;
          slot.stencilVisible = slot.stencil?.visible;
        }
        if (slot.mesh && slot.original) slot.mesh.material = state.patterned ? material : slot.original;
        if (slot.mesh) slot.mesh.visible = (state.patterned || state.outlines) && (slot.outlineVisible ?? true);
        if (slot.stencil) slot.stencil.visible = !state.patterned && state.outlines && (slot.stencilVisible ?? true);
      }
    },
    dispose() {
      restore(slots.left);
      restore(slots.right);
      material.dispose();
    },
  };
};
