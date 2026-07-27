export const catalogueSuggestionLimit = 7;
export const catalogueSuggestionMinimumQueryLength = 2;

export type CatalogueSearchRequest = {
  query: string;
  market: 'NG' | 'US';
  searchable: boolean;
};

export function parseCatalogueSearchRequest(url: string): CatalogueSearchRequest {
  const params = new URL(url).searchParams;
  const query = (params.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  return {
    query,
    market: params.get('market') === 'US' ? 'US' : 'NG',
    searchable: query.length >= catalogueSuggestionMinimumQueryLength,
  };
}
