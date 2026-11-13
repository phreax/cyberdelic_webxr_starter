import { SIMPLEX_3D_GLSL } from './simplex3d.glsl.js';
import sourceFbmGlsl from './fbm.glsl?raw';

/** Fractal Brownian motion over 3D simplex noise. Octave count is a define to keep loops static. */
export const FBM_GLSL = sourceFbmGlsl.replace('__SIMPLEX_3D_GLSL__', SIMPLEX_3D_GLSL);
