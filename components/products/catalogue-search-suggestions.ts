export type CatalogueSearchSuggestionKind = 'product' | 'company' | 'category' | 'guide';

export type CatalogueSearchSuggestion = {
  kind: CatalogueSearchSuggestionKind;
  label: string;
  detail: string;
  href: string;
  keywords?: string[];
};

export type CatalogueSearchGuide = {
  slug: string;
  name: string;
  area: string;
  summary: string;
  signals: string[];
  productTerms: string[];
};

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function catalogueGuideSearchSuggestions(
  guides: CatalogueSearchGuide[],
): CatalogueSearchSuggestion[] {
  return guides.map(guide => ({
    kind: 'guide',
    label: guide.name,
    detail: `${guide.area} guide · Not a recommendation`,
    href: `/concerns/${guide.slug}`,
    keywords: [
      guide.slug,
      guide.summary,
      ...guide.signals,
      ...guide.productTerms,
    ],
  }));
}

export function matchingCatalogueSearchSuggestions(
  suggestions: CatalogueSearchSuggestion[],
  query: string,
  limit = 7,
) {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const unique = suggestions.filter((suggestion, index, items) =>
    index === items.findIndex(item => item.kind === suggestion.kind && item.href === suggestion.href),
  );

  if (!tokens.length) return unique.slice(0, safeLimit);

  return unique
    .map((suggestion, index) => {
      const label = normalize(suggestion.label);
      const detail = normalize(suggestion.detail);
      const normalizedKeywords = (suggestion.keywords ?? []).map(normalize);
      const search = normalize([suggestion.label, suggestion.detail, ...(suggestion.keywords ?? [])].join(' '));
      if (!tokens.every(token => search.includes(token))) return null;
      const exactGuideMatch = suggestion.kind === 'guide'
        && [label, ...normalizedKeywords].includes(normalizedQuery);
      const score = exactGuideMatch
        ? 120
        : label === normalizedQuery
        ? 100
        : label.startsWith(normalizedQuery)
          ? 80
          : label.split(' ').some(word => word.startsWith(normalizedQuery))
            ? 65
            : detail.startsWith(normalizedQuery)
              ? 50
              : 30;
      return { suggestion, score, index };
    })
    .filter((match): match is { suggestion: CatalogueSearchSuggestion; score: number; index: number } => Boolean(match))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, safeLimit)
    .map(match => match.suggestion);
}
