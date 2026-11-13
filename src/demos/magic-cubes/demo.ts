// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createMagicCubesExperience } from './cubes-experience.js';
export default defineDemo({
  id: 'cubes',
  title: 'Cubes',
  order: 50,
  panelNode: 'cubes-panel',
  config: () => ({ level: sceneUrl('cubes.iwsdk.scene.json'), scene: createMagicCubesExperience() }),
});
