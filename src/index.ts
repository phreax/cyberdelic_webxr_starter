import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { resolveExample } from './core/xr/example-registry.js';
import { createExperience } from './core/xr/experience.js';
import { DEFAULT_EXAMPLE, EXAMPLES } from './examples/registry.js';

type ExampleId = keyof typeof EXAMPLES;

// Pick the first example with ?example=<id>; the menu's "Demos" row switches in place (no reload,
// the XR session stays open).
const { id: initial, fallbackReason } = resolveExample(location.search, EXAMPLES, DEFAULT_EXAMPLE);
if (fallbackReason) console.warn(`[cyberdelic] ${fallbackReason}`);

const list = (Object.keys(EXAMPLES) as ExampleId[]).map((id) => ({ id, title: EXAMPLES[id].title }));

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  let current: { dispose(): void } | undefined;
  let switching: Promise<void> = Promise.resolve();

  const start = (id: ExampleId, first: boolean) => {
    switching = switching.then(async () => {
      current?.dispose();
      current = undefined;
      try {
        const config = EXAMPLES[id].config();
        current = await createExperience(world, {
          mode: 'mixed-reality',
          ...config,
          // iwsdk.config.json already loaded the default example's scene on startup.
          level: first && id === DEFAULT_EXAMPLE ? undefined : config.level,
          examples: {
            current: id,
            list,
            switchTo: (next) => {
              if (!(next in EXAMPLES) || next === id) return;
              history.replaceState(null, '', `?example=${next}`);
              start(next as ExampleId, false);
            },
          },
        });
      } catch (error) {
        console.error(`[cyberdelic] Failed to start example "${id}"`, error);
      }
    });
  };

  start(initial, true);
  import.meta.hot?.dispose(() => current?.dispose());
});
