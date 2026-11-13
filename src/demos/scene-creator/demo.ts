// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createSnakeExperience } from '../snake-creator/snake-experience.js';

/** Snakes plus one Center Object, chosen from every `center.ts` in the demo folders. */
export default defineDemo({
  id: 'scene',
  title: 'Scene Creator',
  order: 40,
  panelNode: 'snake-list',
  config: () => ({ level: sceneUrl('scene.iwsdk.scene.json'), persist: { params: false }, scene: createSnakeExperience({ sceneCreator: true }) }),
});
