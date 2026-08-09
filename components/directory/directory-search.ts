export type DirectorySearchItem = {
  href: string;
  name: string;
  detail: string;
  searchText?: string;
};

function searchable(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-NG")
    .replace(/\p{Diacritic}/gu, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function filterDirectorySuggestions(
  items: readonly DirectorySearchItem[],
  query: string,
) {
  const tokens = searchable(query).split(" ").filter(Boolean);
  if (!tokens.length) return [...items];

  return items.filter((item) => {
    const haystack = searchable(
      `${item.name} ${item.detail} ${item.searchText ?? ""}`,
    );
    return tokens.every((token) => haystack.includes(token));
  });
}
