import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createPlaygroundBell,
  createPlaygroundButton,
  createPlaygroundCube,
  createPlaygroundGazeOrb,
  createPlaygroundGem,
  createPlaygroundRail,
  createPlaygroundSlider,
} from './scene-assets/playground.scene-asset.js';
import { createGardenZone, createParticleGarden } from './scene-assets/particle-garden.scene-asset.js';
import { createReactiveSculpture } from './scene-assets/reactive-sculpture.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'reactive-sculpture': createReactiveSculpture(),
  'control-panel': uikitml('control-panel.uikitml', 'Control Panel'),

  // Playground (?example=playground)
  'playground-panel': uikitml('playground-panel.uikitml', 'Playground Panel'),
  toolbar: uikitml('toolbar.uikitml', 'Toolbar'),
  'playground-cube': createPlaygroundCube(),
  'playground-gem': createPlaygroundGem(),
  'playground-slider': createPlaygroundSlider(),
  'playground-rail': createPlaygroundRail(),
  'playground-bell': createPlaygroundBell(),
  'playground-gaze-orb': createPlaygroundGazeOrb(),
  'playground-button': createPlaygroundButton(),

  // Particle Garden (?example=garden)
  'particle-garden': createParticleGarden(),
  'garden-zone': createGardenZone(),
  'garden-panel': uikitml('garden-panel.uikitml', 'Garden Panel'),

  // Snake Creator (?example=snake)
  'snake-panel': uikitml('snake-panel.uikitml', 'Snake Panel'),
});
