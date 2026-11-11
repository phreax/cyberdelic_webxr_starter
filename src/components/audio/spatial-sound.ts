import { Audio, AudioListener, AudioLoader, PositionalAudio, type Object3D } from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';

/**
 * SpatialSound / AmbientSound (PRD §11.3) over Three.js audio. A single AudioListener rides on
 * the camera. Nothing plays until `play()` is called from a user gesture.
 */
const listeners = new WeakMap<object, AudioListener>();
const listenerFor = (ctx: ExperienceContext) => {
  let listener = listeners.get(ctx.world);
  if (!listener) {
    listener = new AudioListener();
    ctx.world.camera.add(listener);
    listeners.set(ctx.world, listener);
  }
  return listener;
};

type SoundSource = { url: string } | { node: (context: AudioContext) => AudioNode };

const load = async (sound: Audio<GainNode | PannerNode>, source: SoundSource, loop: boolean) => {
  if ('url' in source) {
    const buffer = await new AudioLoader().loadAsync(source.url);
    sound.setBuffer(buffer);
    sound.setLoop(loop);
  } else {
    sound.setNodeSource(source.node(sound.context) as AudioScheduledSourceNode);
  }
};

/** Positional sound attached to an object (distance attenuation + panning). */
export const createSpatialSound = (
  ctx: ExperienceContext,
  object: Object3D,
  source: SoundSource,
  { loop = true, volume = 1, refDistance = 0.5, rolloff = 1.5 } = {},
) => {
  const sound = new PositionalAudio(listenerFor(ctx));
  sound.setRefDistance(refDistance);
  sound.setRolloffFactor(rolloff);
  sound.setVolume(volume);
  object.add(sound);
  let ready: Promise<void> | undefined;
  return {
    sound,
    async play() {
      if (sound.context.state === 'suspended') await sound.context.resume();
      ready ??= load(sound, source, loop);
      await ready;
      if ('url' in source && !sound.isPlaying) sound.play();
    },
    stop() {
      if ('url' in source && sound.isPlaying) sound.stop();
      else sound.disconnect();
    },
    dispose() {
      if (sound.isPlaying) sound.stop();
      object.remove(sound);
    },
  };
};

/** Non-positional background sound. */
export const createAmbientSound = (ctx: ExperienceContext, source: { url: string }, { loop = true, volume = 0.5 } = {}) => {
  const sound = new Audio(listenerFor(ctx));
  sound.setVolume(volume);
  let ready: Promise<void> | undefined;
  return {
    sound,
    async play() {
      if (sound.context.state === 'suspended') await sound.context.resume();
      ready ??= load(sound, source, loop);
      await ready;
      if (!sound.isPlaying) sound.play();
    },
    stop: () => sound.isPlaying && sound.stop(),
    dispose: () => sound.isPlaying && sound.stop(),
  };
};
