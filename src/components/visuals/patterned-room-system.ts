// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { createSystem, DoubleSide, Mesh, ShaderMaterial, Vector2, XRMesh, XRPlane, type Material } from '@iwsdk/core';
import { handAppearanceState, patternedVisionFragment } from './patterned-hands.js';
import vertexShader from './patterned-room.vert.glsl?raw';
import fragmentSource from './patterned-room.frag.glsl?raw';

type OriginalSurface = { material: Material | Material[]; visible: boolean; renderOrder: number };

/** Displays the shared Patterned Vision shader on WebXR detected room geometry. */
export class PatternedRoomSystem extends createSystem({
  meshes: { required: [XRMesh] },
  planes: { required: [XRPlane] },
}) {
  private material!: ShaderMaterial;
  private originals = new WeakMap<Mesh, OriginalSurface>();
  private time = 0;

  init(): void {
    const state = handAppearanceState(this.world);
    this.material = new ShaderMaterial({
      name: 'patterned-vision-room',
      vertexShader,
      fragmentShader: patternedVisionFragment(fragmentSource),
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: state.roomScale },
        uWarpAmount: { value: state.warpAmount },
        uPosition: { value: new Vector2(state.positionX, state.positionY) },
        uAlpha: { value: state.roomAlpha },
        uChromaAmount: { value: state.chromaAmount },
      },
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.cleanupFuncs.push(() => {
      for (const entity of this.queries.meshes.entities) this.applySurface(entity.object3D, false);
      for (const entity of this.queries.planes.entities) this.applySurface(entity.object3D, false);
      this.material.dispose();
    });
  }

  private applySurface(object: unknown, enabled: boolean): void {
    if (!(object instanceof Mesh)) return;
    const original = this.originals.get(object);
    if (enabled) {
      if (!original) this.originals.set(object, { material: object.material, visible: object.visible, renderOrder: object.renderOrder });
      if (object.material !== this.material) object.material = this.material;
      object.visible = true;
      object.renderOrder = -1;
    } else if (original) {
      object.material = original.material;
      object.visible = original.visible;
      object.renderOrder = original.renderOrder;
      this.originals.delete(object);
    }
  }

  update(delta: number): void {
    const state = handAppearanceState(this.world);
    this.time += delta;
    const uniforms = this.material.uniforms;
    uniforms.uTime!.value = this.time;
    uniforms.uScale!.value = state.roomScale;
    uniforms.uWarpAmount!.value = state.warpAmount;
    (uniforms.uPosition!.value as Vector2).set(state.positionX, state.positionY);
    uniforms.uAlpha!.value = state.roomAlpha;
    uniforms.uChromaAmount!.value = state.chromaAmount;

    const useMeshes = this.queries.meshes.entities.size > 0;
    for (const entity of this.queries.meshes.entities) this.applySurface(entity.object3D, state.roomPatterned);
    for (const entity of this.queries.planes.entities) this.applySurface(entity.object3D, state.roomPatterned && !useMeshes);
  }
}
