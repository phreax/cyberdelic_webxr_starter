// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import type { CubeTexture, Object3D, World } from '@iwsdk/core';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { Crawl } from './crawl.js';
import type { Curve } from './curve.js';
import type { SnakeLook } from './snake-look.js';

/** Extra meshes one snake draws for a plug-in body (on top of, or instead of, the shader tube). */
export type SnakeBodyLayer = {
  /** Added under the snake. */
  mesh: Object3D;
  /** Copy for the mirrored snake; shares geometry/material, synced in `update`. */
  mirrorMesh?: Object3D;
  setCurve(curve: Curve | null): void;
  setPalette(stops: readonly string[]): void;
  setWarmth(value: number): void;
  setVisible(visible: boolean): void;
  /** Per frame in view mode. */
  update(look: SnakeLook, crawl: Crawl): void;
  dispose(): void;
};

export type SnakeBodyLayerOptions = {
  environment: CubeTexture | null;
  /** The tube shader's live depth-occlusion uniforms, for materials that occlude the same way. */
  depthUniforms?: Record<string, { value: unknown }>;
};

/**
 * An extra Snake Creator body type. Put `export default defineSnakeBody({...})` in a demo folder's
 * `snake-body.ts`. Its button (`body-<id>`) and settings sections live in snake-params.uikitml.
 */
export type SnakeBodyDefinition = {
  id: string;
  label: string;
  order: number;
  /** The shader tube while this body is active: thinner, and optionally a single glowing hue. */
  core?: { thicknessScale: number; glow: boolean };
  /** Palette picked when switching to this body from the default palette. */
  defaultPalette?: string;
  /** Extra look settings: sliders with these ids in snake-params.uikitml, saved in the look. */
  params?: Record<string, ParameterDefinition>;
  /** Panel element ids shown only while this body is selected. */
  sections?: readonly string[];
  /** Grab / bounds radius as a multiple of the snake thickness (default 2). */
  reach?(look: SnakeLook): number;
  /** Load shared resources once (e.g. a glTF) and return a layer factory. */
  load(world: World): Promise<(options: SnakeBodyLayerOptions) => SnakeBodyLayer>;
};

export const defineSnakeBody = (definition: SnakeBodyDefinition): SnakeBodyDefinition => definition;

/** A plug-in setting saved in the look, or its default when the snake was made without it. */
export const lookNumber = (look: SnakeLook, key: string, fallback: number): number => {
  const value = look[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};
