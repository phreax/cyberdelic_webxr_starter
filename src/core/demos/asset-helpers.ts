import { AssetType } from '@iwsdk/core';

/**
 * Small helpers for per-demo `assets.ts` files. These run in both the app and the editor, so keep
 * them pure: no World, DOM, timers or shared state.
 */
export const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

/** A runtime-loaded UIKitML panel in `public/ui/`. */
export const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

/** A glTF/GLB model in `public/models/`, loaded on demand. */
export const lazyModel = (fileName: string, name: string) => ({
  url: publicAssetUrl(`models/${fileName}`),
  type: AssetType.GLTF,
  priority: 'lazy' as const,
  name,
});
