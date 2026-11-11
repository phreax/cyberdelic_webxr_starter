import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { createExperience } from './core/xr/experience.js';
import { createReactiveSculptureExperience } from './examples/reactive-sculpture/reactive-sculpture-experience.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then(async (world) => {
  const { dispose } = await createExperience(world, {
    mode: 'mixed-reality',
    audio: true,
    // osc: true, // start `npm run osc-bridge` first; see docs/osc.md
    scene: createReactiveSculptureExperience(),
  });
  import.meta.hot?.dispose(dispose);
});
