export type CatalogueSearchSuggestionKind =
  "product" | "company" | "category" | "guide";

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
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function tokenMatchScore(token: string, values: string[]) {
  let score = 0;
  for (const value of values) {
    for (const word of words(value)) {
      if (word === token) score = Math.max(score, 30);
      else if (word.startsWith(token)) score = Math.max(score, 22);
      else if (token.length >= 4 && word.includes(token))
        score = Math.max(score, 8);
    }
  }
  return score;
}

function boostedTokenMatchScore(
  token: string,
  values: string[],
  boost: number,
) {
  const score = tokenMatchScore(token, values);
  return score ? score + boost : 0;
}

export function catalogueGuideSearchSuggestions(
  guides: CatalogueSearchGuide[],
): CatalogueSearchSuggestion[] {
  return guides.map((guide) => ({
    kind: "guide",
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
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const unique = suggestions.filter(
    (suggestion, index, items) =>
      index ===
      items.findIndex(
        (item) =>
          item.kind === suggestion.kind && item.href === suggestion.href,
      ),
  );

  if (!tokens.length) return unique.slice(0, safeLimit);

  return unique
    .map((suggestion, index) => {
      const label = normalize(suggestion.label);
      const detail = normalize(suggestion.detail);
      const normalizedKeywords = (suggestion.keywords ?? []).map(normalize);
      const labelValues = [suggestion.label];
      const detailValues = [suggestion.detail];
      const keywordValues = suggestion.keywords ?? [];
      const tokenScores = tokens.map((token) =>
        Math.max(
          boostedTokenMatchScore(token, labelValues, 40),
          boostedTokenMatchScore(token, detailValues, 20),
          tokenMatchScore(token, keywordValues),
        ),
      );
      if (tokenScores.some((score) => score === 0)) return null;
      const exactGuideMatch =
        suggestion.kind === "guide" &&
        [label, ...normalizedKeywords].includes(normalizedQuery);
      const score =
        tokenScores.reduce((total, value) => total + value, 0) +
        (exactGuideMatch ? 180 : 0) +
        (label === normalizedQuery ? 150 : 0) +
        (label.startsWith(normalizedQuery) ? 90 : 0) +
        (detail === normalizedQuery ? 45 : 0);
      return { suggestion, score, index };
    })
    .filter(
      (
        match,
      ): match is {
        suggestion: CatalogueSearchSuggestion;
        score: number;
        index: number;
      } => Boolean(match),
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, safeLimit)
    .map((match) => match.suggestion);
}
