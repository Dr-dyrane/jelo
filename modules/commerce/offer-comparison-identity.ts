export function normalizeComparisonOfferUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Binds a checked-in comparison decision to one exact catalogue offer. A
 * retailer- or product-level match is deliberately insufficient because a
 * sibling listing may carry different seller, pack, or price evidence.
 */
export function comparisonOfferIdentityKey(input: {
  productSlug: string;
  retailer: string;
  url: string;
}): string | null {
  const productSlug = input.productSlug.trim();
  const retailer = input.retailer.trim().toLocaleLowerCase("en-NG");
  const url = normalizeComparisonOfferUrl(input.url);
  if (!productSlug || !retailer || !url) return null;
  return `${productSlug}\u0000${retailer}\u0000${url}`;
}
