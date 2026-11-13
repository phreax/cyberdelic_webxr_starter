import { collectDemos, type DemoDefinition } from '../core/demos/define-demo.js';

/**
 * Every `demo.ts` in `src/demos/*` (public) and `src/lab/*` (your private experiments) is picked up
 * automatically. Add a folder to add a demo; delete it to remove one. No other file changes needed.
 */
export const DEMOS: readonly DemoDefinition[] = collectDemos({
  ...import.meta.glob<{ default: DemoDefinition }>('./*/demo.ts', { eager: true }),
  ...import.meta.glob<{ default: DemoDefinition }>('../lab/*/demo.ts', { eager: true }),
});

export const EXAMPLES: Readonly<Record<string, DemoDefinition>> = Object.fromEntries(DEMOS.map((demo) => [demo.id, demo]));

/** Loaded first; its scene is the one named in iwsdk.config.json. */
export const DEFAULT_EXAMPLE = 'sculpture';
