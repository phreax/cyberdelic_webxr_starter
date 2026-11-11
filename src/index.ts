import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { createExperience } from './core/xr/experience.js';
import { createPlaceholderExperience } from './examples/placeholder/placeholder-experience.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then(async (world) => {
  const { dispose } = await createExperience(world, {
    mode: 'mixed-reality',
    scene: createPlaceholderExperience(),
  });
  import.meta.hot?.dispose(dispose);
});
