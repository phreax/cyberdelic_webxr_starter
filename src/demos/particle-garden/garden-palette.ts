import { DataTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from '@iwsdk/core';
import { bakePalette, PALETTE_SIZE, type PaletteName } from '../../shaders/color/palettes.js';

/** Two palette textures for cross-fading moods: `from` → `to` while the mix runs 0 → 1. */
export const createMoodPalettes = () => {
  const make = () => {
    const texture = new DataTexture(new Uint8Array(PALETTE_SIZE * 4), PALETTE_SIZE, 1);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  };
  let from = make();
  let to = make();
  return {
    get from() {
      return from;
    },
    get to() {
      return to;
    },
    /** Start a fade to `name`: the current target becomes the source. */
    set(name: PaletteName, instant = false) {
      [from, to] = [to, from];
      (to.image.data as Uint8Array).set(bakePalette(name));
      to.needsUpdate = true;
      if (instant) {
        (from.image.data as Uint8Array).set(bakePalette(name));
        from.needsUpdate = true;
      }
    },
    dispose() {
      from.dispose();
      to.dispose();
    },
  };
};
