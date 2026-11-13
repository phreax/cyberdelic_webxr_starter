// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import type { SnakeBodyDefinition } from './body-plugin.js';

type BodyModule = { default: SnakeBodyDefinition };

/** Built-in bodies, drawn by the shader tube itself. */
export const BUILT_IN_BODIES = [{ id: 'tube', label: 'Tube' }, { id: 'spheres', label: 'Spheres' }] as const;

/** Every `snake-body.ts` in src/demos/* and the private src/lab/*. */
export const SNAKE_BODIES: readonly SnakeBodyDefinition[] = Object.values({
  ...import.meta.glob<BodyModule>('../*/snake-body.ts', { eager: true }),
  ...import.meta.glob<BodyModule>('../../lab/*/snake-body.ts', { eager: true }),
}).map((module) => module.default).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const snakeBody = (id: string): SnakeBodyDefinition | undefined => SNAKE_BODIES.find((body) => body.id === id);

/** Saved looks may name a body that is not installed here (e.g. a lab body on main): draw a tube. */
export const resolveBodyId = (id: string): string =>
  BUILT_IN_BODIES.some((body) => body.id === id) || snakeBody(id) ? id : 'tube';
