import { AssetType, defineAssets } from '@iwsdk/core';
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
});
