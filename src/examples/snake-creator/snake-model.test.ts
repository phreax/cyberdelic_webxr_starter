import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { sampleCurve } from './curve.js';
import { fitPathFromStroke } from './path.js';
import { addSnake, createSnakeState, deleteSnake, MAX_SNAKES, selectedSnake, selectSnake, setClosed, setEditing, updateSnake } from './snake-model.js';

const line = () => fitPathFromStroke([{ x: 0, y: 1, z: -1 }, { x: 0.4, y: 1, z: -1 }]);

describe('snake list', () => {
  test('add', () => {
    const state = addSnake(addSnake(createSnakeState()));
    assert({
      given: 'two added snakes',
      should: 'name them in order and select the newest',
      actual: { names: state.snakes.map((s) => s.name), selected: selectedSnake(state)?.name },
      expected: { names: ['Snake 1', 'Snake 2'], selected: 'Snake 2' },
    });
  });

  test('limit', () => {
    let state = createSnakeState();
    for (let i = 0; i < MAX_SNAKES + 2; i += 1) state = addSnake(state);
    assert({
      given: 'more adds than the limit',
      should: 'stop at the limit',
      actual: state.snakes.length,
      expected: MAX_SNAKES,
    });
  });

  test('delete selects a neighbour', () => {
    let state = addSnake(addSnake(addSnake(createSnakeState())));
    const [a, b, c] = state.snakes;
    state = selectSnake(state, b!.id);
    state = deleteSnake(state, b!.id);
    const afterMiddle = selectedSnake(state)?.id;
    state = deleteSnake(deleteSnake(state, a!.id), c!.id);

    assert({
      given: 'deleting the selected middle snake, then all others',
      should: 'select the next one, then nothing',
      actual: [afterMiddle === c!.id, state.selectedId, state.snakes.length],
      expected: [true, null, 0],
    });
  });

  test('edit mode follows selection', () => {
    let state = addSnake(createSnakeState());
    const id = state.snakes[0]!.id;
    state = setEditing(state, true);
    const editing = state.editing;
    state = deleteSnake(state, id);
    assert({
      given: 'editing the selected snake, which is then deleted',
      should: 'leave edit mode',
      actual: [editing, state.editing],
      expected: [true, false],
    });
  });
});

describe('setClosed()', () => {
  test('two-point loop', () => {
    let state = addSnake(createSnakeState(), { path: line() });
    const id = state.snakes[0]!.id;
    state = setClosed(state, id, true);
    const snake = state.snakes[0]!;
    const curve = sampleCurve(snake.path, snake.closed)!;

    assert({
      given: 'a two-point path closed into a loop',
      should: 'close it as an oval (longer than going there and back)',
      actual: [snake.closed, curve.length > 0.8 * 1.05],
      expected: [true, true],
    });
  });

  test('updates', () => {
    let state = addSnake(createSnakeState(), { path: line() });
    const id = state.snakes[0]!.id;
    state = updateSnake(state, id, { name: 'Coral' });
    assert({
      given: 'a patch for one snake',
      should: 'update only that snake',
      actual: state.snakes[0]!.name,
      expected: 'Coral',
    });
  });
});
