import { refitEndHandles, type Anchor } from './path.js';
import { DEFAULT_LOOK, type SnakeLook } from './snake-look.js';

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
};

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
