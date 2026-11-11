/**
 * Press → release pairing used for UI activation. Replaces the pointer-events `click`, which is
 * dropped for presses longer than 300 ms (common with XR triggers and hand pinches).
 */
export const createPressTracker = ({ maxMs = 1500 } = {}) => {
  let down: { pointerId: number; at: number } | undefined;
  return {
    down(pointerId: number, now: number): void {
      down = { pointerId, at: now };
    },
    /** True when this release completes a press by the same pointer within `maxMs`. */
    up(pointerId: number, now: number): boolean {
      const press = down;
      down = undefined;
      return press !== undefined && press.pointerId === pointerId && now - press.at <= maxMs;
    },
    cancel(): void {
      down = undefined;
    },
  };
};
