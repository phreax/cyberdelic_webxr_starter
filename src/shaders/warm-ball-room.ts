import { CubeTextureLoader, SRGBColorSpace } from '@iwsdk/core';

/** The existing warm ball room cubemap, shared by the creative materials. */
export const loadWarmBallRoom = () => {
  const faces = Array.from({ length: 6 }, (_, i) => `${import.meta.env.BASE_URL}textures/warm-ball-room/warm_ball_room_${i}.jpg`);
  const texture = new CubeTextureLoader().load(faces);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};
