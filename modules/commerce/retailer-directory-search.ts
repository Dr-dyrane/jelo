export type RetailerDirectoryItem = {
  rank: number;
  slug: string;
  name: string;
  kind: string;
  productCount: number;
  evidenceNote: string;
};

function searchable(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-NG")
    .replace(/\p{Diacritic}/gu, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function filterRetailerDirectory(
  items: readonly RetailerDirectoryItem[],
  query: string,
) {
  const tokens = searchable(query).split(" ").filter(Boolean);
  if (!tokens.length) return [...items];

  return items.filter((item) => {
    const haystack = searchable(
      `${item.name} ${item.kind} ${item.productCount} products ${item.evidenceNote}`,
    );
    return tokens.every((token) => haystack.includes(token));
  });
}
