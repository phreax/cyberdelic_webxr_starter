// SPDX-License-Identifier: CC-BY-NC-SA-4.0
/**
 * Saved Scene Creator object state. Pure data + helpers; which types exist comes from the
 * `center.ts` plug-ins (see center-registry.ts). The standalone demo is read only when an object is added.
 */
export type CenterType = string;
export type CenterTransform = { position: [number, number, number]; quaternion: [number, number, number, number]; scale: number };
export type CenterObjectState = { type: CenterType; settings: Record<string, number>; visible: boolean; transform: CenterTransform };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const copyVisualSettings = (
  keys: readonly string[],
  definitions: Record<string, { default: number; min?: number; max?: number }>,
  saved: unknown,
): Record<string, number> => {
  const source = saved && typeof saved === 'object' ? saved as Record<string, unknown> : {};
  return Object.fromEntries(keys.map((key) => {
    const definition = definitions[key]!;
    const value = finite(source[key]) ? source[key] : definition.default;
    return [key, Math.max(definition.min ?? -Infinity, Math.min(definition.max ?? Infinity, value))];
  }));
};

export const defaultCenterTransform = (): CenterTransform => ({ position: [0, 1.3, -1], quaternion: [0, 0, 0, 1], scale: 1 });

/** Convert a live object's physical scale to the multiplier used by another asset type. */
export const centerTransformAtScale = (
  position: readonly [number, number, number],
  quaternion: readonly [number, number, number, number],
  physicalScale: number,
  targetBaseScale: number,
): CenterTransform => ({ position: [...position], quaternion: [...quaternion], scale: physicalScale / targetBaseScale });

export const addCenter = (
  type: CenterType,
  settings: Record<string, number>,
  transform: CenterTransform = defaultCenterTransform(),
): CenterObjectState => ({
  type, settings: { ...settings }, visible: true,
  transform: { position: [...transform.position], quaternion: [...transform.quaternion], scale: transform.scale },
});

export const restoreCenter = (
  raw: unknown,
  /** Settings definitions for a type, or undefined when that type is not installed (e.g. a lab object on main). */
  definitions: (type: CenterType) => Record<string, { default: number; min?: number; max?: number }> | undefined,
  keys: (type: CenterType) => readonly string[],
): CenterObjectState | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<CenterObjectState>;
  const definition = typeof record.type === 'string' ? definitions(record.type) : undefined;
  if (!definition) return null;
  const t = record.transform;
  if (!t || !Array.isArray(t.position) || t.position.length !== 3 || !t.position.every(finite)
    || !Array.isArray(t.quaternion) || t.quaternion.length !== 4 || !t.quaternion.every(finite)
    || !finite(t.scale) || t.scale <= 0) return null;
  return {
    type: record.type!,
    settings: copyVisualSettings(keys(record.type!), definition, record.settings),
    visible: record.visible !== false,
    transform: { position: [...t.position], quaternion: [...t.quaternion], scale: t.scale },
  };
};
