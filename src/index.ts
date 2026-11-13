import { DepthSensingSystem, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { resolveExample } from './core/xr/example-registry.js';
import { installLightEstimationOptIn } from './core/xr/light-estimation-opt-in.js';
import { createExperience, type ExampleSwitcher } from './core/xr/experience.js';
import { PatternedRoomSystem } from './components/visuals/patterned-room-system.js';
import { DEFAULT_EXAMPLE, DEMOS, EXAMPLES } from './demos/registry.js';

installLightEstimationOptIn();

// Pick the first example with ?example=<id>; the menu's "Demos" row switches in place (no reload,
// the XR session stays open).
const { id: initial, fallbackReason } = resolveExample(location.search, EXAMPLES, DEFAULT_EXAMPLE);
if (fallbackReason) console.warn(`[cyberdelic] ${fallbackReason}`);

const list = DEMOS.map(({ id, title, panelNode }) => ({ id, title, panelNode }));

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  world.registerSystem(DepthSensingSystem, {
    configData: { enableDepthTexture: true, enableOcclusion: true, useFloat32: true, blurRadius: 20 },
  });
  world.registerSystem(PatternedRoomSystem);
  let current: { dispose(): void } | undefined;
  let currentId: string | undefined;
  const consolePlacement: NonNullable<ExampleSwitcher['consolePlacement']> = {};
  let switching: Promise<void> = Promise.resolve();

  const start = (id: string, first: boolean) => {
    switching = switching.then(async () => {
      current?.dispose();
      current = undefined;
      try {
        const config = EXAMPLES[id]!.config();
        current = await createExperience(world, {
          mode: 'mixed-reality',
          ...config,
          // iwsdk.config.json already loaded the default example's scene on startup.
          level: first && id === DEFAULT_EXAMPLE ? undefined : config.level,
          examples: {
            current: id,
            list,
            consolePlacement,
            switchTo: (next) => {
              if (!(next in EXAMPLES) || next === id) return;
              history.replaceState(null, '', `?example=${next}`);
              start(next, false);
            },
            reload: () => start(id, false),
          },
        });
        currentId = id;
      } catch (error) {
        console.error(`[cyberdelic] Failed to start example "${id}"`, error);
      }
    });
  };

  start(initial, true);
  import.meta.hot?.dispose(() => current?.dispose());
});
