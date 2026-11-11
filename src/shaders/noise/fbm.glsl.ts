import { SIMPLEX_3D_GLSL } from './simplex3d.glsl.js';

/** Fractal Brownian motion over 3D simplex noise. Octave count is a define to keep loops static. */
export const FBM_GLSL = /* glsl */ `
${SIMPLEX_3D_GLSL}
#ifndef FBM_OCTAVES
#define FBM_OCTAVES 3
#endif
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < FBM_OCTAVES; i++) {
    sum += amp * snoise(p);
    p = p * 2.02 + vec3(17.1, 3.7, 9.2);
    amp *= 0.5;
  }
  return sum;
}
`;
