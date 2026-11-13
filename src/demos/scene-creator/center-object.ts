// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { DataTexture, LinearFilter, Mesh, RepeatWrapping, ShaderMaterial, SRGBColorSpace, type CubeTexture, type Object3D } from '@iwsdk/core';
import type { ParameterDefinition } from '../../core/parameters/store.js';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { bakePalette, PALETTE_SIZE, type PaletteName } from '../../shaders/color/palettes.js';

export type CenterSettings = Readonly<Record<string, number>>;
export type CenterEnvironment = { warmRoom: CubeTexture; gemRoom: CubeTexture };

/** The live, placed visual of one Center Object type. */
export type CenterVisual = {
  /** Push the saved settings into materials (called on every settings change). */
  apply(settings: CenterSettings): void;
  /** Per frame while visible. */
  update?(dt: number, settings: CenterSettings): void;
  setEnvironmentWarmth?(value: number): void;
  /** Shown/hidden together with the placed object (for extra meshes outside its hierarchy). */
  setVisible?(visible: boolean): void;
  /** Only for `manipulable` objects: hand-pinch manipulation instead of move/rotate gestures. */
  setManipulating?(on: boolean): void;
};

/**
 * A Scene Creator Center Object. Put `export default defineCenterObject({...})` in a demo folder's
 * `center.ts` and it appears in the Scene Creator's object picker. Its settings controls live in
 * `public/ui/snake-params.uikitml` as `choose-<id>`, `setting-<id>-<key>` and `center-<id>-<key>`.
 */
export type CenterObjectDefinition = {
  /** Stable id: saved in scenes and used in UI element ids. */
  id: string;
  label: string;
  order: number;
  /** Manifest id of the placed asset (scene-asset Object3D or glTF). */
  assetId: string;
  /** Scale that makes the asset roughly 0.5 m across. */
  baseScale: number;
  /** Shared with the standalone demo, so saved demo settings seed a new Center Object. */
  params: Record<string, ParameterDefinition>;
  /** Params that only make sense in the standalone demo (audio reactivity, session toggles). */
  excludedSettings?: readonly string[];
  /** Offers the "Manipulate" toggle (hand pinch deforms the object instead of moving it). */
  manipulable?: boolean;
  attach(ctx: ExperienceContext, object: Object3D, environment: CenterEnvironment): CenterVisual;
};

export const defineCenterObject = (definition: CenterObjectDefinition): CenterObjectDefinition => definition;

/** Settings the Scene Creator copies and saves for a type (never the scene-wide reflection warmth). */
export const centerSettingKeys = (definition: Pick<CenterObjectDefinition, 'params' | 'excludedSettings'>): string[] =>
  Object.keys(definition.params).filter((key) => key !== 'reflectionWarmth' && !definition.excludedSettings?.includes(key));

type Uniforms = Record<string, { value: unknown }>;

/** `speed` → `uSpeed`, plus the few historical names that don't follow the pattern. */
export const uniformNameFor = (key: string): string =>
  key === 'finish' ? 'uMaterial' : key === 'iridescent' ? 'uIridescence'
    : key === 'reflectionAmount' ? 'uReflectionAmount' : `u${key[0]!.toUpperCase()}${key.slice(1)}`;

/** Quality setting (0 low, 1 medium, 2 high) as an index into a steps table. */
export const qualityIndex = (settings: CenterSettings): number => Math.max(0, Math.min(2, Math.round(settings.quality ?? 1)));

export type ShaderCenterHooks = {
  uniforms: Uniforms;
  mesh: Mesh;
  object: Object3D;
  ctx: ExperienceContext;
};

/**
 * Center Object built from a scene asset whose mesh uses a named ShaderMaterial. Covers the common
 * case: numeric settings map to `u<Key>` uniforms, `quality` picks `uSteps`, `palette` bakes into
 * `uPalette`, and `uTime` advances by `speed`.
 */
export const shaderCenter = (options: {
  materialName: string;
  environment?: keyof CenterEnvironment;
  qualitySteps?: readonly number[];
  /** Palette to bake into `uPalette` for the current settings. */
  palette?: (settings: CenterSettings) => PaletteName;
  /** `uTime` speed when the object has no `speed` setting. `false` leaves `uTime` alone. */
  defaultSpeed?: number | false;
  onAttach?(hooks: ShaderCenterHooks): void;
  onApply?(hooks: ShaderCenterHooks, settings: CenterSettings): void;
  onUpdate?(hooks: ShaderCenterHooks, dt: number, elapsed: number, settings: CenterSettings): void;
  setManipulating?(hooks: ShaderCenterHooks, on: boolean): void;
}) => (ctx: ExperienceContext, object: Object3D, environment: CenterEnvironment): CenterVisual => {
  let found: Mesh | undefined;
  object.traverse((child) => {
    if (found || !(child instanceof Mesh) || !(child.material instanceof ShaderMaterial) || child.material.name !== options.materialName) return;
    found = child;
  });
  if (!found) throw new Error(`Center Object material missing: ${options.materialName}`);
  const mesh: Mesh = found;
  // Each placed object owns its material so it never restyles the standalone demo's instances.
  const material = (mesh.material as ShaderMaterial).clone();
  mesh.material = material;
  ctx.track(() => material.dispose());
  const uniforms = material.uniforms as Uniforms;
  const hooks: ShaderCenterHooks = { uniforms, mesh, object, ctx };
  if (uniforms.uEnvironment) uniforms.uEnvironment.value = environment[options.environment ?? 'warmRoom'];
  let palette: DataTexture | undefined;
  if (uniforms.uPalette) {
    palette = ctx.track(new DataTexture(new Uint8Array(PALETTE_SIZE * 4), PALETTE_SIZE, 1));
    palette.colorSpace = SRGBColorSpace;
    palette.magFilter = LinearFilter;
    palette.minFilter = LinearFilter;
    palette.wrapS = RepeatWrapping;
    uniforms.uPalette.value = palette;
  }
  // Only overwrite scalar uniforms: settings such as `palette` or `glowColor` share a name with a
  // texture / Color uniform, and writing a number there breaks every following frame's render.
  const setScalar = (name: string, value: number) => {
    const uniform = uniforms[name];
    if (uniform && typeof uniform.value === 'number') uniform.value = value;
  };
  let elapsed = 0;
  options.onAttach?.(hooks);
  return {
    apply(settings) {
      for (const [key, value] of Object.entries(settings)) setScalar(uniformNameFor(key), value);
      if (options.qualitySteps) setScalar('uSteps', options.qualitySteps[qualityIndex(settings)]!);
      if (palette) {
        (palette.image.data as Uint8Array).set(bakePalette(options.palette?.(settings) ?? 'Ethereal Garden'));
        palette.needsUpdate = true;
      }
      options.onApply?.(hooks, settings);
    },
    update(dt, settings) {
      if (options.defaultSpeed !== false) {
        elapsed += dt * (settings.speed ?? options.defaultSpeed ?? 1);
        setScalar('uTime', elapsed);
      }
      options.onUpdate?.(hooks, dt, elapsed, settings);
    },
    setEnvironmentWarmth(value) { setScalar('uReflectionWarmth', value); },
    setManipulating: options.setManipulating && ((on) => options.setManipulating!(hooks, on)),
  };
};
