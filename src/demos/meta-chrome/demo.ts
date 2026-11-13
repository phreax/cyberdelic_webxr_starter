// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineDemo, sceneUrl } from '../../core/demos/define-demo.js';
import { createMetaChromeExperience } from './meta-chrome-experience.js';
export default defineDemo({
  id: 'chrome',
  title: 'Meta Chrome',
  order: 60,
  panelNode: 'chrome-panel',
  config: () => ({ level: sceneUrl('chrome.iwsdk.scene.json'), scene: createMetaChromeExperience() }),
});
