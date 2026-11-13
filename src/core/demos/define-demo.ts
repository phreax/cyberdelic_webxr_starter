import type { ExperienceConfig } from '../xr/experience.js';

/**
 * One entry in the Demos menu. Every folder in `src/demos/` (and the optional private
 * `src/lab/`) that has a `demo.ts` exporting `defineDemo(...)` as default shows up automatically.
 *
 * File conventions inside a demo folder (all optional except `demo.ts`):
 * - `demo.ts`        → this definition (menu entry + how to start the experience)
 * - `assets.ts`      → manifest entries merged into `src/assets.ts`
 * - `center.ts`      → a Center Object for the Scene Creator
 * - `snake-body.ts`  → an extra body type for the Snake Creator
 */
export type DemoDefinition = {
  /** URL id: `?example=<id>`. Keep it short, lowercase, kebab-case. */
  id: string;
  /** Label in the Demos menu. */
  title: string;
  /** Position in the Demos menu (lower first). */
  order: number;
  /** Scene node id of the demo's main panel, placed in the shared console arc next to the Demos picker. */
  panelNode?: string;
  /** Experience config (scene JSON, audio, persistence, the experience itself). */
  config: () => Omit<ExperienceConfig, 'mode' | 'examples'>;
};

/** Identity helper that gives `demo.ts` files type checking and autocompletion. */
export const defineDemo = (demo: DemoDefinition): DemoDefinition => demo;

/** URL of a scene JSON in `public/scenes/` (works with subpath deploys). */
export const sceneUrl = (file: string): string => `${import.meta.env.BASE_URL}scenes/${file}`;

/** Sort discovered modules by `order`, then id, and reject duplicate ids early. */
export const collectDemos = (modules: Record<string, { default: DemoDefinition }>): DemoDefinition[] => {
  const demos = Object.values(modules).map((module) => module.default).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  for (const demo of demos) {
    if (seen.has(demo.id)) throw new Error(`Duplicate demo id "${demo.id}"`);
    seen.add(demo.id);
  }
  return demos;
};
