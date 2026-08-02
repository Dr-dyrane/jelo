export type QueueSearchParams = {
  id?: string | string[];
};

const queueUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function selectedQueueItemId(searchParams: QueueSearchParams) {
  const rawId = Array.isArray(searchParams.id) ? searchParams.id[0] : searchParams.id;
  const id = rawId?.trim();
  return id || null;
}

export function isQueueItemUuid(value: string): boolean {
  return queueUuidPattern.test(value);
}

export function selectedQueueUuid(searchParams: QueueSearchParams) {
  const id = selectedQueueItemId(searchParams);
  return id && isQueueItemUuid(id) ? id : null;
}

export function includeSelectedQueueItem<T extends { id: string }>(
  rows: T[],
  selected: T | null,
) {
  if (!selected || rows.some(row => row.id === selected.id)) return rows;
  return [...rows, selected];
}

export function queueSelectionHref(
  pathname: string,
  currentQuery: string,
  selectedId: string | null,
) {
  const params = new URLSearchParams(currentQuery);

  if (selectedId) params.set('id', selectedId);
  else params.delete('id');

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
