// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { Vector3, type Object3D, type World } from '@iwsdk/core';
import { CHROME_SCALE } from './meta-chrome-material.js';

type PinchUniforms = {
  uPinchActive?: { value: number };
  uRightPinchActive?: { value: number };
  uPinchPoint?: { value: Vector3 };
  uRightPinchPoint?: { value: Vector3 };
};

/**
 * Hand pinches pull the chrome surface: each pinching index tip is sent to the shader in the
 * object's raymarch space. Allocates once; call `update` every frame.
 */
export const createChromePinch = (world: World, object: Object3D, uniforms: PinchUniforms) => {
  const point = new Vector3();
  const send = (hand: 'left' | 'right', active: boolean, target: { value: Vector3 } | undefined) => {
    if (!active || !target) return;
    world.player.indexTipSpaces[hand].getWorldPosition(point);
    object.worldToLocal(point);
    point.multiplyScalar(CHROME_SCALE);
    point.x = -point.x;
    point.z = -point.z;
    target.value.copy(point);
  };
  return {
    update(enabled: boolean) {
      const left = enabled && world.input.xr.isPrimary('hand', 'left') && world.input.xr.getSelectState('left').active;
      const right = enabled && world.input.xr.isPrimary('hand', 'right') && world.input.xr.getSelectState('right').active;
      if (uniforms.uPinchActive) uniforms.uPinchActive.value = left ? 1 : 0;
      if (uniforms.uRightPinchActive) uniforms.uRightPinchActive.value = right ? 1 : 0;
      send('left', left, uniforms.uPinchPoint);
      send('right', right, uniforms.uRightPinchPoint);
    },
  };
};
