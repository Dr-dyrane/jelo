export function resolveOrderQueueSelection<T extends { id: string }>(
  orders: readonly T[],
  selectedId: string | null,
) {
  if (selectedId) {
    const selected = orders.find((order) => order.id === selectedId) ?? null;
    return { selected, selectionMissing: selected === null };
  }

  return {
    selected: null,
    selectionMissing: false,
  };
}
