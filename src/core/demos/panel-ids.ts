import { readFileSync } from 'node:fs';

/** Test helper: every `id="..."` in a UIKitML file under public/ui (e.g. 'cubes-panel', or 'lab/<name>' for private lab panels). */
export const panelIds = (file: string): Set<string> =>
  new Set([...readFileSync(new URL(`../../../public/ui/${file}.uikitml`, import.meta.url), 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
/** Ids a bound slider needs. */
export const sliderIds = (names: readonly string[]) => names.flatMap((id) => [id, `${id}-fill`, `${id}-value`]);
/** Ids a bound toggle needs. */
export const toggleIds = (names: readonly string[]) => names.flatMap((id) => [id, `${id}-thumb`]);
/** Close + quality controls every raymarched demo panel shares. */
export const SESSION_IDS = ['btn-hide', 'quality-low', 'quality-medium', 'quality-high'];
