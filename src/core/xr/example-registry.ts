/** Pick an example from `?example=<id>`; unknown ids fall back to the default. */
export const resolveExample = <Registry extends Readonly<Record<string, unknown>>, Id extends keyof Registry & string = keyof Registry & string>(
  search: string,
  registry: Registry,
  defaultId: NoInfer<Id>,
): { id: Id; fallbackReason?: string } => {
  const requested = new URLSearchParams(search).get('example');
  if (!requested) return { id: defaultId };
  if (requested in registry) return { id: requested as Id };
  return {
    id: defaultId,
    fallbackReason: `Unknown example "${requested}". Available: ${Object.keys(registry).join(', ')}. Showing "${defaultId}".`,
  };
};
