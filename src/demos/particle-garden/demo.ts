import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createParticleGardenExperience } from './garden-experience.js';
export default defineDemo({
  id: 'garden',
  title: 'Garden',
  order: 20,
  panelNode: 'garden-panel',
  config: () => ({ level: sceneUrl('garden.iwsdk.scene.json'), audio: true, scene: createParticleGardenExperience() }),
});
