import { defineAssets } from '@iwsdk/core';
import { uikitml } from './core/demos/asset-helpers.js';

type AssetModule = { default: Record<string, unknown> };

/**
 * Shared assets plus every demo's own `assets.ts` (src/demos/* and the private src/lab/*).
 * Evaluated by both the app and the editor: keep every assets.ts pure and deterministic.
 */
const demoAssets = Object.assign(
  {},
  ...Object.values(import.meta.glob<AssetModule>('./demos/*/assets.ts', { eager: true })).map((module) => module.default),
  ...Object.values(import.meta.glob<AssetModule>('./lab/*/assets.ts', { eager: true })).map((module) => module.default),
) as Parameters<typeof defineAssets>[0];

export default defineAssets({
  'demos-panel': uikitml('demos-panel.uikitml', 'Demos'),
  ...demoAssets,
});
