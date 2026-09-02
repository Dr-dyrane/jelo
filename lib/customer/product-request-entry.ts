const PRODUCT_REQUEST_ENTRY = "/me/shelf/add";
const MARKET_FINDER_PRODUCT_REQUEST_ENTRY = `${PRODUCT_REQUEST_ENTRY}?from=market-finder`;
const PRODUCT_REQUEST_SEED_LIMIT = 240;
const UNSAFE_QUERY_CHARACTERS =
  /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu;

export function normalizeProductRequestEntrySeed(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .normalize("NFKC")
    .replace(UNSAFE_QUERY_CHARACTERS, " ")
    .trim()
    .replace(/\s+/gu, " ");
  if (!normalized) return undefined;
  return [...normalized].slice(0, PRODUCT_REQUEST_SEED_LIMIT).join("");
}

export type ProductRequestEntryHref =
  | typeof PRODUCT_REQUEST_ENTRY
  | `${typeof MARKET_FINDER_PRODUCT_REQUEST_ENTRY}&request=${string}`;

export function productRequestEntryHref(
  value?: unknown,
): ProductRequestEntryHref {
  const request = normalizeProductRequestEntrySeed(value);
  if (!request) return PRODUCT_REQUEST_ENTRY;
  return `${MARKET_FINDER_PRODUCT_REQUEST_ENTRY}&request=${encodeURIComponent(request)}`;
}
