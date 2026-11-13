import { uikitml } from '../../core/demos/asset-helpers.js';
import { createGardenZone, createParticleGarden } from './particle-garden.scene-asset.js';

export default {
  'particle-garden': createParticleGarden(),
  'garden-zone': createGardenZone(),
  'garden-panel': uikitml('garden-panel.uikitml', 'Garden Panel'),
};
