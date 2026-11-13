import { uikitml } from '../../core/demos/asset-helpers.js';
import { createReactiveSculpture } from './reactive-sculpture.scene-asset.js';

export default {
  'reactive-sculpture': createReactiveSculpture(),
  'control-panel': uikitml('control-panel.uikitml', 'Control Panel'),
};
