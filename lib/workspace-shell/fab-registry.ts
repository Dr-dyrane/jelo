export type DockFabRegistration<Value> = {
  ownerId: string;
  routeKey: string;
  value: Value;
};

export type DockFabRegistryEntry<Value> = DockFabRegistration<Value> & {
  token: string;
  sequence: number;
};

export type DockFabRegistry<Value> = {
  routeKey: string;
  nextSequence: number;
  entries: readonly DockFabRegistryEntry<Value>[];
};

export function createDockFabRegistry<Value>(routeKey: string): DockFabRegistry<Value> {
  return { routeKey, nextSequence: 0, entries: [] };
}

export function registerDockFab<Value>(
  registry: DockFabRegistry<Value>,
  registration: DockFabRegistration<Value>,
  token: string,
): DockFabRegistry<Value> {
  if (registration.routeKey !== registry.routeKey || !token) return registry;
  const sequence = registry.nextSequence + 1;
  return {
    ...registry,
    nextSequence: sequence,
    entries: [
      ...registry.entries.filter((entry) => entry.token !== token),
      { ...registration, token, sequence },
    ],
  };
}

export function unregisterDockFab<Value>(
  registry: DockFabRegistry<Value>,
  token: string,
): DockFabRegistry<Value> {
  const entries = registry.entries.filter((entry) => entry.token !== token);
  return entries.length === registry.entries.length ? registry : { ...registry, entries };
}

export function resolveDockFab<Value>(registry: DockFabRegistry<Value>) {
  return [...registry.entries].sort((left, right) => right.sequence - left.sequence)[0];
}
