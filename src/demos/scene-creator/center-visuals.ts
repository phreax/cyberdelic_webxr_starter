// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { CubeTextureLoader, type Entity } from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { loadWarmBallRoom } from '../../shaders/warm-ball-room.js';
import type { CenterEnvironment, CenterObjectDefinition, CenterVisual } from './center-object.js';
import type { CenterObjectState, CenterTransform } from './center-model.js';
import { centerTransformAtScale } from './center-model.js';
import { CENTER_OBJECTS, centerObject } from './center-registry.js';

export type CenterEntry = { definition: CenterObjectDefinition; entity: Entity; visual: CenterVisual };

const cubemapUrls = Array.from({ length: 6 }, (_, i) => `${import.meta.env.BASE_URL}textures/warm-ball-room/warm_ball_room_${i}.jpg`);

/**
 * One placed, hidden instance per registered Center Object type (see center-registry.ts), created at
 * runtime from the asset manifest. Only the selected type is shown. `ready` resolves once every
 * type is placed; calls made before that are remembered and applied then.
 */
export const createCenterVisuals = (ctx: ExperienceContext, onEntryReady?: (entry: CenterEntry) => void) => {
  const entries = new Map<string, CenterEntry>();
  const environment: CenterEnvironment = {
    warmRoom: ctx.track(loadWarmBallRoom()),
    gemRoom: ctx.track(new CubeTextureLoader().load(cubemapUrls)),
  };
  let current: CenterObjectState | null = null;
  let environmentWarmth = 0.5;
  let disposed = false;
  ctx.track(() => { disposed = true; });

  const place = async (definition: CenterObjectDefinition) => {
    const object = await ctx.world.assets.instantiate(definition.assetId);
    if (disposed) return;
    object.scale.setScalar(definition.baseScale);
    object.visible = false;
    const entity = ctx.track(ctx.world.createTransformEntity(object));
    const visual = definition.attach(ctx, object, environment);
    visual.setEnvironmentWarmth?.(environmentWarmth);
    const entry = { definition, entity, visual };
    entries.set(definition.id, entry);
    onEntryReady?.(entry);
    if (current?.type === definition.id) apply(current);
  };
  const ready = Promise.allSettled(CENTER_OBJECTS.map(place)).then((results) => {
    results.forEach((result, i) => {
      if (result.status === 'rejected') console.warn(`[scene-creator] Center Object "${CENTER_OBJECTS[i]!.id}" could not load`, result.reason);
    });
  });

  const apply = (state: CenterObjectState | null) => {
    current = state;
    for (const [type, entry] of entries) {
      const visible = state?.type === type && state.visible;
      entry.entity.object3D!.visible = visible;
      entry.visual.setVisible?.(visible);
    }
    if (!state) return;
    const entry = entries.get(state.type);
    if (!entry) return;
    const object = entry.entity.object3D!;
    object.position.set(...state.transform.position);
    object.quaternion.set(...state.transform.quaternion);
    object.scale.setScalar(entry.definition.baseScale * state.transform.scale);
    entry.visual.apply(state.settings);
    entry.visual.setEnvironmentWarmth?.(environmentWarmth);
  };
  /** The live pose, expressed as a multiplier of `forType`'s base scale (so swaps keep the physical size). */
  const readTransform = (forType: string = current?.type ?? ''): CenterTransform | null => {
    const entry = current && entries.get(current.type);
    if (!entry) return null;
    const object = entry.entity.object3D!;
    return centerTransformAtScale(
      [object.position.x, object.position.y, object.position.z],
      [object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w],
      object.scale.x, centerObject(forType)?.baseScale ?? entry.definition.baseScale,
    );
  };
  const update = (dt: number) => {
    if (!current?.visible) return;
    entries.get(current.type)?.visual.update?.(dt, current.settings);
  };
  const setEnvironmentWarmth = (value: number) => {
    environmentWarmth = Math.max(0, Math.min(1, value));
    for (const entry of entries.values()) entry.visual.setEnvironmentWarmth?.(environmentWarmth);
  };
  return { entries, ready, apply, update, readTransform, setEnvironmentWarmth };
};
