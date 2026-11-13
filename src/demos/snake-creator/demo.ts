// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createSnakeExperience } from './snake-experience.js';

// Snakes are saved by the experience itself, so the params store (which only mirrors the
// selected snake) is not persisted.
export default defineDemo({
  id: 'snake',
  title: 'Snake Creator',
  order: 30,
  panelNode: 'snake-list',
  config: () => ({ level: sceneUrl('snake.iwsdk.scene.json'), persist: { params: false }, scene: createSnakeExperience() }),
});
