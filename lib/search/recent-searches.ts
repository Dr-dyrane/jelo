const recentSearchesKey = "jelocare:global-search:recent:v1";
export const recentSearchLimit = 6;

type SearchStorage = Pick<Storage, "getItem" | "setItem">;

function normalizedKey(value: string) {
  return value.trim().toLocaleLowerCase("en-NG");
}

export function readRecentSearches(storage: SearchStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(recentSearchesKey) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
      .slice(0, recentSearchLimit);
  } catch {
    return [];
  }
}

export function recordRecentSearch(
  storage: SearchStorage,
  query: string,
): string[] {
  const value = query.trim().slice(0, 120);
  if (normalizedKey(value).length < 2) return readRecentSearches(storage);
  const key = normalizedKey(value);
  const next = [
    value,
    ...readRecentSearches(storage).filter(
      (item) => normalizedKey(item) !== key,
    ),
  ].slice(0, recentSearchLimit);

  try {
    storage.setItem(recentSearchesKey, JSON.stringify(next));
  } catch {
    // Search still works when device storage is unavailable.
  }
  return next;
}

export function clearRecentSearches(storage: SearchStorage): string[] {
  try {
    storage.setItem(recentSearchesKey, "[]");
  } catch {
    // Search still works when device storage is unavailable.
  }
  return [];
}
