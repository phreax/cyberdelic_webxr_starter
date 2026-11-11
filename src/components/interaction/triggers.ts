/** Pure trigger state machines used by ProximityTrigger / GazeTrigger / Draggable. */

/** Enter at `radius`, exit only beyond `radius + hysteresis`, so a hovering hand doesn't flicker. */
export const createProximityState = ({ radius, hysteresis = 0.03 }: { radius: number; hysteresis?: number }) => {
  let inside = false;
  return {
    get inside() {
      return inside;
    },
    update(distance: number): 'enter' | 'exit' | null {
      if (!inside && distance <= radius) {
        inside = true;
        return 'enter';
      }
      if (inside && distance > radius + hysteresis) {
        inside = false;
        return 'exit';
      }
      return null;
    },
  };
};

/** Fires once after gaze stays within `angle` (radians) for `dwell` seconds; resets when gaze leaves. */
export const createGazeDwell = ({ dwell, angle }: { dwell: number; angle: number }) => {
  let held = 0;
  let fired = false;
  return {
    /** 0..1 dwell progress, for a fill/ring indicator. */
    get progress() {
      return Math.min(1, held / dwell);
    },
    update(angleToTarget: number, dt: number): boolean {
      if (angleToTarget > angle) {
        held = 0;
        fired = false;
        return false;
      }
      held += dt;
      if (!fired && held >= dwell) {
        fired = true;
        return true;
      }
      return false;
    },
  };
};

type Vec3 = [number, number, number];

/** Grab translate limits that allow movement along one axis only (±range from start). */
export const axisConstraint = (start: readonly [number, number, number], axis: 'x' | 'y' | 'z', range: number) => {
  const index = { x: 0, y: 1, z: 2 }[axis];
  const translateMin = [...start] as Vec3;
  const translateMax = [...start] as Vec3;
  translateMin[index] = start[index] - range;
  translateMax[index] = start[index] + range;
  return { translateMin, translateMax };
};
