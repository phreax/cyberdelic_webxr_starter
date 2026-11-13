// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineCenterObject, shaderCenter } from '../scene-creator/center-object.js';
import { CUBE_PALETTES, CUBES_PARAMS } from './cubes-experience.js';
import { CUBES_QUALITY_STEPS } from './cubes-material.js';

export default defineCenterObject({
  id: 'cubes',
  label: 'Cubes',
  order: 50,
  assetId: 'magic-cubes',
  baseScale: 0.2,
  params: CUBES_PARAMS,
  attach: shaderCenter({
    materialName: 'magic-cubes',
    qualitySteps: CUBES_QUALITY_STEPS,
    palette: (settings) => CUBE_PALETTES[Math.round(settings.palette ?? 0)] ?? 'Ethereal Garden',
  }),
});
