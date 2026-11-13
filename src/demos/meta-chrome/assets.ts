// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { uikitml } from '../../core/demos/asset-helpers.js';
import { createMetaChrome } from './meta-chrome.scene-asset.js';

export default {
  'meta-chrome': createMetaChrome(),
  'chrome-panel': uikitml('chrome-panel.uikitml', 'Meta Chrome Panel'),
};
