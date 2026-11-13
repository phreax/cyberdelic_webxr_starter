// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { uikitml } from '../../core/demos/asset-helpers.js';
import { createMagicCubes } from './magic-cubes.scene-asset.js';

export default {
  'magic-cubes': createMagicCubes(),
  'cubes-panel': uikitml('cubes-panel.uikitml', 'Cubes Panel'),
};
