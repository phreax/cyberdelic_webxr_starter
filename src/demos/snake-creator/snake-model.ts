// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { refitEndHandles, type Anchor, type Point } from './path.js';
import { DEFAULT_LOOK, type SnakeLook } from './snake-look.js';
import { SNAKE_PALETTES } from './gradient.js';

/** Pure, immutable model of the snakes in the scene (list, selection, edit mode). */
export const MAX_SNAKES = 8;

export type SnakeRecord = {
  id: string;
  name: string;
  path: Anchor[];
  closed: boolean;
  look: SnakeLook;
  /** Palette name for the gradient. */
  palette: string;
  /** Where the snake was placed / how it was resized (grab), if moved. */
  transform?: SnakeTransform;
};

export type SnakeTransform = { position: [number, number, number]; quaternion: [number, number, number, number]; scale: number };

export type SnakeState = {
  snakes: readonly SnakeRecord[];
  selectedId: string | null;
  editing: boolean;
  nextNumber: number;
};

export const createSnakeState = (): SnakeState => ({ snakes: [], selectedId: null, editing: false, nextNumber: 1 });

export const selectedSnake = (state: SnakeState): SnakeRecord | undefined =>
  state.snakes.find((snake) => snake.id === state.selectedId);

export const addSnake = (
  state: SnakeState,
  init: Partial<Pick<SnakeRecord, 'path' | 'closed' | 'look' | 'palette' | 'name'>> = {},
): SnakeState => {
  if (state.snakes.length >= MAX_SNAKES) return state;
  const number = state.nextNumber;
  const snake: SnakeRecord = {
    id: `snake-${number}`,
    name: init.name ?? `Snake ${number}`,
    path: init.path ?? [],
    closed: init.closed ?? false,
    look: { ...DEFAULT_LOOK, ...init.look },
    palette: init.palette ?? 'Ethereal Garden',
  };
  return { ...state, snakes: [...state.snakes, snake], selectedId: snake.id, nextNumber: number + 1 };
};

export const deleteSnake = (state: SnakeState, id: string): SnakeState => {
  const index = state.snakes.findIndex((snake) => snake.id === id);
  if (index < 0) return state;
  const snakes = state.snakes.filter((snake) => snake.id !== id);
  const wasSelected = state.selectedId === id;
  const neighbour = snakes[index] ?? snakes[index - 1];
  return {
    ...state,
    snakes,
    selectedId: wasSelected ? (neighbour?.id ?? null) : state.selectedId,
    editing: wasSelected ? false : state.editing,
  };
};

export const selectSnake = (state: SnakeState, id: string | null): SnakeState =>
  id === null || state.snakes.some((snake) => snake.id === id) ? { ...state, selectedId: id, editing: id === null ? false : state.editing } : state;

export const setEditing = (state: SnakeState, editing: boolean): SnakeState => ({
  ...state,
  editing: editing && state.selectedId !== null,
});

export const updateSnake = (state: SnakeState, id: string, patch: Partial<Omit<SnakeRecord, 'id'>>): SnakeState => ({
  ...state,
  snakes: state.snakes.map((snake) => (snake.id === id ? { ...snake, ...patch, look: { ...snake.look, ...patch.look } } : snake)),
});

/** Open or close a path; works from two anchors up and keeps the seam / ends smooth. */
export const setClosed = (state: SnakeState, id: string, closed: boolean): SnakeState => {
  const snake = state.snakes.find((s) => s.id === id);
  if (!snake || snake.path.length < 2) return state;
  return updateSnake(state, id, { closed, path: refitEndHandles(snake.path, closed) });
};

// --- Persistence -------------------------------------------------------------------------

export type SavedSnakes = { snakes: Array<Omit<SnakeRecord, never>>; selectedId: string | null; nextNumber: number };

export const serializeSnakeState = (state: SnakeState): SavedSnakes => ({
  snakes: state.snakes.map((snake) => ({ ...snake })),
  selectedId: state.selectedId,
  nextNumber: state.nextNumber,
});

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: unknown): v is Point =>
  typeof v === 'object' && v !== null && isNumber((v as Point).x) && isNumber((v as Point).y) && isNumber((v as Point).z);
const isAnchor = (v: unknown): v is Anchor =>
  typeof v === 'object' && v !== null && isPoint((v as Anchor).point) && isPoint((v as Anchor).inHandle) && isPoint((v as Anchor).outHandle);

const restoreLook = (raw: unknown): SnakeLook => {
  const look: SnakeLook = { ...DEFAULT_LOOK };
  if (typeof raw !== 'object' || raw === null) return look;
  for (const [key, fallback] of Object.entries(DEFAULT_LOOK) as Array<[keyof SnakeLook, SnakeLook[keyof SnakeLook]]>) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === typeof fallback && (typeof value !== 'number' || Number.isFinite(value))) (look as Record<string, unknown>)[key] = value;
  }
  return look;
};

const restoreTransform = (raw: unknown): SnakeTransform | undefined => {
  const t = raw as SnakeTransform | undefined;
  if (!t || !Array.isArray(t.position) || !Array.isArray(t.quaternion) || !isNumber(t.scale)) return undefined;
  if (t.position.length !== 3 || t.quaternion.length !== 4 || ![...t.position, ...t.quaternion].every(isNumber)) return undefined;
  return { position: [...t.position] as SnakeTransform['position'], quaternion: [...t.quaternion] as SnakeTransform['quaternion'], scale: t.scale };
};

/** Validate saved data field by field; broken snakes are dropped. Undefined when nothing usable. */
export const restoreSnakeState = (raw: unknown): SnakeState | undefined => {
  const saved = raw as Partial<SavedSnakes> | undefined;
  if (!saved || !Array.isArray(saved.snakes)) return undefined;
  const snakes: SnakeRecord[] = [];
  for (const item of saved.snakes.slice(0, MAX_SNAKES)) {
    const s = item as Partial<SnakeRecord>;
    if (typeof s.id !== 'string' || !Array.isArray(s.path) || !s.path.every(isAnchor)) continue;
    snakes.push({
      id: s.id,
      name: typeof s.name === 'string' ? s.name : s.id,
      path: s.path,
      closed: s.closed === true && s.path.length >= 2,
      look: restoreLook(s.look),
      palette: typeof s.palette === 'string' && s.palette in SNAKE_PALETTES ? s.palette : 'Ethereal Garden',
      transform: restoreTransform(s.transform),
    });
  }
  const highest = Math.max(0, ...snakes.map((s) => Number(/(\d+)$/.exec(s.id)?.[1] ?? 0)));
  const nextNumber = Math.max(highest + 1, isNumber(saved.nextNumber) ? saved.nextNumber : 1);
  const selectedId = snakes.some((s) => s.id === saved.selectedId) ? (saved.selectedId as string) : (snakes[0]?.id ?? null);
  return { snakes, selectedId, editing: false, nextNumber };
};
