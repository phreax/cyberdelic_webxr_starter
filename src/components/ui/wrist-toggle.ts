/**
 * Wrist menu button: fires once when the button becomes pressed (finger poke, or a ray aimed at it
 * plus pinch / trigger), then ignores presses for `debounceMs`. Hover alone, or a pinch while the
 * ray merely passes over the button, never fires.
 */
export const createWristToggle = ({ debounceMs = 500 }: { debounceMs?: number } = {}) => {
  let wasPressed = false;
  let lastFired = -Infinity;
  return {
    update(pressed: boolean, now: number): boolean {
      const fire = pressed && !wasPressed && now - lastFired > debounceMs;
      wasPressed = pressed;
      if (fire) lastFired = now;
      return fire;
    },
  };
};
