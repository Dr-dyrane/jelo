const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

export type RedirectContext = {
  productSlug: string;
  retailer: string;
};

export function buildAttributedUrl(destination: string, context: RedirectContext) {
  const url = new URL(destination);
  const values = {
    utm_source: 'jelocare.com',
    utm_medium: 'referral',
    utm_campaign: 'trusted_product_discovery',
    utm_content: `${context.productSlug}:${slugify(context.retailer)}`,
  };

  for (const key of TRACKING_KEYS) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, values[key]);
  }

  return url.toString();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
