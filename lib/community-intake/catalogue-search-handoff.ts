import {
  adaptiveValueSchema,
  type AdaptiveValue,
} from './schema';

export const catalogueSearchAttribution = {
  source: 'catalogue_search',
  medium: 'research_handoff',
  campaign: 'missing_product',
} as const;

type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function productLabel(value: SearchParamValue) {
  const raw = first(value);
  if (typeof raw !== 'string') return null;
  const normalized = raw.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 120);
  return normalized.length ? normalized : null;
}

export function catalogueSearchHandoffHref(query: string) {
  const product = productLabel(query);
  if (!product) return null;
  const params = new URLSearchParams({
    product,
    utm_source: catalogueSearchAttribution.source,
    utm_medium: catalogueSearchAttribution.medium,
    utm_campaign: catalogueSearchAttribution.campaign,
  });
  return `/contribute?${params.toString()}#contribution-form`;
}

export function catalogueSearchProductPrefill(params: {
  product?: SearchParamValue;
  utm_source?: SearchParamValue;
}): AdaptiveValue | null {
  if (first(params.utm_source) !== catalogueSearchAttribution.source) return null;
  const label = productLabel(params.product);
  if (!label) return null;
  const value = adaptiveValueSchema.safeParse({
    id: 'custom:catalogue-search-product',
    label,
    source: 'custom',
  });
  return value.success ? value.data : null;
}
