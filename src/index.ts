import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { resolveExample } from './core/xr/example-registry.js';
import { createExperience } from './core/xr/experience.js';
import { DEFAULT_EXAMPLE, EXAMPLES } from './examples/registry.js';

// Pick an example with ?example=sculpture | playground (see src/examples/registry.ts).
const { id, fallbackReason } = resolveExample(location.search, EXAMPLES, DEFAULT_EXAMPLE);
if (fallbackReason) console.warn(`[cyberdelic] ${fallbackReason}`);

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then(async (world) => {
  const { dispose } = await createExperience(world, { mode: 'mixed-reality', ...EXAMPLES[id].config() });
  import.meta.hot?.dispose(dispose);
});
