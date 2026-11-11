import {
  EnvironmentRaycastTarget,
  InputComponent,
  Mesh,
  MeshBasicMaterial,
  RaycastSpace,
  RingGeometry,
  Vector3,
  type Entity,
} from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';

/**
 * MR surface placement (PRD §11.2): a reticle follows the controller ray onto real surfaces
 * (WebXR hit-test via IWSDK environment raycast); trigger places the entity there.
 * Requires `world.features.environmentRaycast: true` in iwsdk.config.json and an MR session.
 */
export type PlacementStatus = 'idle' | 'aiming' | 'unsupported';

export const createSurfacePlacer = (
  ctx: ExperienceContext,
  entity: Entity,
  { hand = 'right' as 'left' | 'right', lift = 0.15, onStatus = (_: PlacementStatus) => {} } = {},
) => {
  const reticleMaterial = new MeshBasicMaterial({ color: ctx.theme.colors.primary, transparent: true, opacity: 0.9 });
  const reticle = new Mesh(new RingGeometry(0.04, 0.055, 32).rotateX(-Math.PI / 2), reticleMaterial);
  reticle.visible = false;
  const reticleEntity = ctx.world.createTransformEntity(reticle);
  const hit = new Vector3();
  let active = false;

  const supported = () => Boolean(ctx.world.session?.enabledFeatures?.includes('hit-test'));

  const stop = () => {
    active = false;
    if (reticleEntity.hasComponent(EnvironmentRaycastTarget)) reticleEntity.removeComponent(EnvironmentRaycastTarget);
    reticle.visible = false;
    onStatus('idle');
  };

  const off = ctx.onFrame(() => {
    if (!active) return;
    const pad = ctx.world.input.xr.gamepads[hand];
    const result = reticleEntity.getValue(EnvironmentRaycastTarget, 'xrHitTestResult');
    if (result && reticle.visible && pad?.getButtonDown(InputComponent.Trigger)) {
      reticle.getWorldPosition(hit);
      const object = entity.object3D!;
      object.position.copy(hit);
      object.position.y += lift;
      object.parent?.worldToLocal(object.position);
      ctx.haptics.play(hand, 'select');
      ctx.sounds.play('select');
      stop();
    }
  });

  return {
    get active() {
      return active;
    },
    /** Start aiming. Returns false (and reports 'unsupported') without hit-test support. */
    start(): boolean {
      if (!supported()) {
        onStatus('unsupported');
        return false;
      }
      active = true;
      reticleEntity.addComponent(EnvironmentRaycastTarget, { space: hand === 'right' ? RaycastSpace.Right : RaycastSpace.Left });
      onStatus('aiming');
      return true;
    },
    stop,
    dispose() {
      off();
      reticleEntity.dispose();
      reticleMaterial.dispose();
    },
  };
};
