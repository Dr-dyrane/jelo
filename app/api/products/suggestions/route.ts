import { searchCatalogueSuggestions } from '@/lib/catalogue/catalogue-search-repository';
import {
  catalogueSuggestionLimit,
  parseCatalogueSearchRequest,
} from '@/lib/catalogue/catalogue-search-request';
import { catalogueSearchRateLimit } from '@/lib/catalogue/catalogue-search-security';

export async function GET(request: Request) {
  const rateLimit = await catalogueSearchRateLimit(request);

  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Please wait a moment before searching again.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const search = parseCatalogueSearchRequest(request.url);
  const suggestions = search.searchable
    ? await searchCatalogueSuggestions(search.query, search.market, catalogueSuggestionLimit)
    : [];

  return Response.json(
    { suggestions },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  );
}
