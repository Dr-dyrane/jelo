import type { InventoryQuery } from './inventory-query';

export const inventoryAutoLoadPageLimit = 2;
export const inventoryContinuationBatchPageLimit = 4;

export type InventoryContinuationQuery = Omit<InventoryQuery, 'page'>;

export type InventoryContinuationRequest = {
  query: InventoryContinuationQuery;
  fromPage: number;
  toPage: number;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function positivePage(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' || typeof value === 'string'
    ? Number(value)
    : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function inventoryContinuationTargetPage(value: unknown, pageCount: number) {
  const safePageCount = Math.max(1, Math.trunc(pageCount));
  return Math.min(positivePage(value, 1), safePageCount);
}

export function sanitizeInventoryContinuationRequest(
  value: unknown,
): InventoryContinuationRequest {
  const record = asRecord(value);
  const rawQuery = asRecord(record.query);
  const query: InventoryContinuationQuery = {};
  const stringKeys = [
    'q',
    'category',
    'review',
    'sort',
    'concern',
    'step',
    'brand',
    'availability',
    'price',
    'market',
  ] as const;

  for (const key of stringKeys) {
    const candidate = rawQuery[key];
    if (typeof candidate === 'string') query[key] = candidate;
  }

  const fromPage = Math.max(2, positivePage(record.fromPage, 2));
  const requestedToPage = positivePage(record.toPage, fromPage);

  return {
    query,
    fromPage,
    toPage: Math.max(fromPage, Math.min(requestedToPage, 10_000)),
  };
}

export function inventoryContinuationRange(
  fromPage: number,
  toPage: number,
  pageCount: number,
) {
  const safePageCount = Math.max(1, Math.trunc(pageCount));
  const safeFromPage = Math.max(2, Math.trunc(fromPage));
  if (safeFromPage > safePageCount) return null;

  return {
    fromPage: safeFromPage,
    toPage: Math.min(
      Math.max(safeFromPage, Math.trunc(toPage)),
      safeFromPage + inventoryContinuationBatchPageLimit - 1,
      safePageCount,
    ),
  };
}

export function appendUniqueInventoryItems<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
) {
  const seen = new Set(current.map(item => item.id));
  return [
    ...current,
    ...incoming.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  ];
}

export function inventoryContinuationHref(currentHref: string, page: number) {
  const url = new URL(currentHref, 'https://jelocare.local');
  const safePage = positivePage(page, 1);
  if (safePage <= 1) url.searchParams.delete('page');
  else url.searchParams.set('page', String(safePage));
  url.hash = 'all-products';
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}
