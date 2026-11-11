import type { ExperienceConfig } from '../core/xr/experience.js';
import { createParticleGardenExperience } from './particle-garden/garden-experience.js';
import { createPlaygroundExperience } from './playground/playground-experience.js';
import { createReactiveSculptureExperience } from './reactive-sculpture/reactive-sculpture-experience.js';

const scene = (file: string) => `${import.meta.env.BASE_URL}scenes/${file}`;

/**
 * Examples selectable with ?example=<id>. Each provides its createExperience config;
 * `level` loads the example's own scene (the default example uses the one in iwsdk.config.json).
 */
export const EXAMPLES = {
  sculpture: { title: 'Reactive Sculpture', config: () => ({ audio: true, scene: createReactiveSculptureExperience() }) },
  garden: {
    title: 'Particle Garden',
    config: () => ({ level: scene('garden.iwsdk.scene.json'), audio: true, scene: createParticleGardenExperience() }),
  },
  playground: {
    title: 'Developer Playground',
    config: () => ({ level: scene('playground.iwsdk.scene.json'), osc: true, scene: createPlaygroundExperience() }),
  },
} satisfies Record<string, { title: string; config: () => Omit<ExperienceConfig, 'mode'> }>;

export const DEFAULT_EXAMPLE = 'sculpture' as const;
