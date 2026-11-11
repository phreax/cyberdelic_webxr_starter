import type { ParameterStore } from '../parameters/store.js';

/**
 * Per-example settings in localStorage (`cyberdelic:v1:<namespace>:<key>`, JSON).
 * Never throws: private mode, quota errors and corrupt entries fall back to defaults.
 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const VERSION = 'v1';

export const defaultStorage = (): StorageLike | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

export const createSettingsStorage = (namespace: string, storage: StorageLike | undefined = defaultStorage()) => {
  const prefix = `cyberdelic:${VERSION}:${namespace}:`;
  let enabled = true;
  return {
    /** After a reset nothing may be written back while the example tears down. */
    disable(): void {
      enabled = false;
    },
    load<T = unknown>(key: string): T | undefined {
      try {
        const raw = storage?.getItem(prefix + key);
        return raw == null ? undefined : (JSON.parse(raw) as T);
      } catch {
        return undefined;
      }
    },
    save(key: string, value: unknown): void {
      if (!enabled) return;
      try {
        storage?.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // quota / private mode: settings simply aren't kept
      }
    },
    /** Remove every setting of this namespace. */
    clear(): void {
      try {
        if (!storage) return;
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (key?.startsWith(prefix)) keys.push(key);
        }
        keys.forEach((key) => storage.removeItem(key));
      } catch {
        // ignore
      }
    },
  };
};

export type SettingsStorage = ReturnType<typeof createSettingsStorage>;

/**
 * Restore saved parameter values (known ids, numbers only), then save the snapshot after changes.
 * Saves are coalesced through `schedule` (default: 400 ms timer). Returns a flush + stop handle.
 */
export const persistParams = (
  params: Pick<ParameterStore, 'apply' | 'snapshot' | 'subscribe' | 'ids'>,
  storage: SettingsStorage,
  { key = 'params', schedule = (fn: () => void) => void setTimeout(fn, 400) }: { key?: string; schedule?: (fn: () => void) => void } = {},
) => {
  const saved = storage.load<Record<string, unknown>>(key);
  if (saved && typeof saved === 'object') {
    const known = new Set(params.ids());
    const values = Object.fromEntries(
      Object.entries(saved).filter(([id, value]) => known.has(id) && typeof value === 'number' && Number.isFinite(value)),
    ) as Record<string, number>;
    params.apply(values, 'storage');
  }
  let pending = false;
  let stopped = false;
  const flush = () => {
    pending = false;
    if (!stopped) storage.save(key, params.snapshot());
  };
  const offs = params.ids().map((id) =>
    params.subscribe(id, (_, source) => {
      if (source === 'storage' || pending) return;
      pending = true;
      schedule(flush);
    }),
  );
  return {
    flush,
    /** Stop without saving (used by a settings reset). */
    cancel() {
      stopped = true;
      offs.forEach((off) => off());
    },
    stop() {
      if (pending) flush();
      stopped = true;
      offs.forEach((off) => off());
    },
  };
};
