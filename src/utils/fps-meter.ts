/** Frames per second averaged over a sliding time window (seconds). No allocation per frame after warm-up. */
export const createFpsMeter = ({ window = 1, capacity = 256 } = {}) => {
  const deltas = new Float64Array(capacity);
  let start = 0;
  let count = 0;
  let total = 0;

  return {
    push(dt: number): void {
      if (!(dt > 0)) return;
      if (count === capacity) {
        total -= deltas[start]!;
        start = (start + 1) % capacity;
        count -= 1;
      }
      deltas[(start + count) % capacity] = dt;
      count += 1;
      total += dt;
      while (count > 1 && total - deltas[start]! >= window) {
        total -= deltas[start]!;
        start = (start + 1) % capacity;
        count -= 1;
      }
    },
    fps: (): number => (count === 0 || total <= 0 ? 0 : count / total),
  };
};
