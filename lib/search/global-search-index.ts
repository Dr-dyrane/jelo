export const globalSearchTypes = [
  "all",
  "product",
  "guide",
  "ingredient",
  "retailer",
  "company",
  "category",
] as const;

export type GlobalSearchType = Exclude<
  (typeof globalSearchTypes)[number],
  "all"
>;
export type GlobalSearchFilter = (typeof globalSearchTypes)[number];

export type GlobalSearchEntry = {
  id: string;
  type: GlobalSearchType;
  label: string;
  detail: string;
  href: string;
  keywords: string[];
  external?: boolean;
  image?: string;
  brand?: string;
  size?: string;
};

export type RankedGlobalSearchEntry = GlobalSearchEntry & { score: number };

export const globalSearchTypeLabels: Record<GlobalSearchFilter, string> = {
  all: "All results",
  product: "Products",
  guide: "Guides",
  ingredient: "Ingredients",
  retailer: "Retailers",
  company: "Companies",
  category: "Categories",
};

export function normalizeGlobalSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-NG")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function entryScore(
  entry: GlobalSearchEntry,
  normalizedQuery: string,
  tokens: string[],
) {
  const label = normalizeGlobalSearchText(entry.label);
  const detail = normalizeGlobalSearchText(entry.detail);
  const keywords = normalizeGlobalSearchText(entry.keywords.join(" "));
  const searchable = `${label} ${detail} ${keywords}`;

  if (!tokens.every((token) => searchable.includes(token))) return 0;

  let score = 20;
  if (label === normalizedQuery) score += 180;
  else if (label.startsWith(normalizedQuery)) score += 120;
  else if (label.includes(normalizedQuery)) score += 82;
  if (keywords.includes(normalizedQuery)) score += 35;

  for (const token of tokens) {
    if (label === token) score += 45;
    else if (label.startsWith(token)) score += 28;
    else if (label.includes(token)) score += 18;
    if (detail.includes(token)) score += 7;
    if (keywords.includes(token)) score += 5;
  }

  return score;
}

export function searchGlobalIndex(
  entries: GlobalSearchEntry[],
  query: string,
  filter: GlobalSearchFilter = "all",
  limit = 48,
): RankedGlobalSearchEntry[] {
  const normalizedQuery = normalizeGlobalSearchText(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  return entries
    .filter((entry) => filter === "all" || entry.type === filter)
    .map((entry, index) => ({
      entry,
      index,
      score: entryScore(entry, normalizedQuery, tokens),
    }))
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.entry.label.localeCompare(right.entry.label, "en-NG") ||
        left.index - right.index,
    )
    .slice(0, safeLimit)
    .map(({ entry, score }) => ({ ...entry, score }));
}
