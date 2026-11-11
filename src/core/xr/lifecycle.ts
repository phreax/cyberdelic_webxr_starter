/**
 * Framework-free experience lifecycle: init → update(dt)* → dispose.
 * The IWSDK glue lives in experience.ts; this module stays pure and testable.
 */

export interface Experience<Context> {
  /** Create scene objects, register components and listeners. */
  init?(ctx: Context): void;
  /** Called every frame while running. `dt` is in seconds, already clamped. */
  update?(dt: number, time: number): void;
  /** Release anything not registered through `ctx.track()`. */
  dispose?(): void;
}

export type LifecycleState = 'idle' | 'running' | 'disposed';

/** Longest frame step passed to `update`, so a backgrounded tab does not make animations jump. */
export const MAX_DELTA_SECONDS = 0.1;

export const clampDelta = (dt: number): number =>
  Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_DELTA_SECONDS) : 0;

export const createLifecycle = <Context>(experience: Experience<Context>, ctx: Context) => {
  let state: LifecycleState = 'idle';

  return {
    get state(): LifecycleState {
      return state;
    },
    start(): void {
      if (state !== 'idle') return;
      experience.init?.(ctx);
      state = 'running';
    },
    tick(dt: number, time = 0): void {
      if (state !== 'running') return;
      experience.update?.(clampDelta(dt), time);
    },
    stop(): void {
      if (state === 'disposed') return;
      if (state === 'running') experience.dispose?.();
      state = 'disposed';
    },
  };
};

export type Disposable = (() => void) | { dispose(): void };

/** Collects cleanup work and runs it once, newest first. */
export const createDisposables = () => {
  let items: Disposable[] = [];

  return {
    add<T extends Disposable>(item: T): T {
      items.push(item);
      return item;
    },
    disposeAll(): void {
      const pending = items;
      items = [];
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const item = pending[index]!;
        if (typeof item === 'function') item();
        else item.dispose();
      }
    },
  };
};
