import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createReactiveSculptureExperience } from './reactive-sculpture-experience.js';
export default defineDemo({
  id: 'sculpture',
  title: 'Sculpture',
  order: 10,
  panelNode: 'control-panel',
  config: () => ({ level: sceneUrl('main.iwsdk.scene.json'), audio: true, scene: createReactiveSculptureExperience() }),
});
