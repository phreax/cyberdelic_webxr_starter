// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { centerSettingKeys, type CenterObjectDefinition } from './center-object.js';

type CenterModule = { default: CenterObjectDefinition };

/** Every `center.ts` in src/demos/* and the private src/lab/*, in picker order. */
export const CENTER_OBJECTS: readonly CenterObjectDefinition[] = Object.values({
  ...import.meta.glob<CenterModule>('../*/center.ts', { eager: true }),
  ...import.meta.glob<CenterModule>('../../lab/*/center.ts', { eager: true }),
}).map((module) => module.default).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

const BY_ID = new Map(CENTER_OBJECTS.map((definition) => [definition.id, definition]));

export const CENTER_TYPES: readonly string[] = CENTER_OBJECTS.map((definition) => definition.id);
export const centerObject = (id: string): CenterObjectDefinition | undefined => BY_ID.get(id);
export const centerDefinitions = (id: string) => BY_ID.get(id)?.params;
export const centerKeys = (id: string): string[] => {
  const definition = BY_ID.get(id);
  return definition ? centerSettingKeys(definition) : [];
};
