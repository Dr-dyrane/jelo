/**
 * Selects a small, honest set of representative offers from a larger verified
 * list. Real catalogue products can carry 20-30+ verified Nigerian offers
 * (COSRX's cleanser and B.Lab's sunscreen both cleared 29 in the same
 * verification pass). Rendering every store on the share card and trend chart
 * produces an unreadable wall of near-identical rows.
 *
 * Three points remain representative without inventing a number: the lowest
 * price, the highest price, and a "typical" floor price — the highest-priced
 * offer that does not exceed the statistical median. Using an actual verified
 * offer (rather than the computed median value itself, which may not
 * correspond to any real listing) keeps every rendered price traceable to a
 * real retailer.
 */

export type RepresentativeOfferSelection<T> = {
  lowest: T;
  /** The highest-priced offer at or below the statistical median. */
  median: T;
  highest: T;
  /**
   * Deduplicated by reference identity, ascending by price. 1-3 entries.
   * Use this to render — `lowest`/`median`/`highest` are for tagging which
   * entry plays which role (they may point at the same object when the
   * input has very few offers).
   */
  unique: T[];
};

export function selectRepresentativeOffers<T>(
  offers: readonly T[],
  priceOf: (offer: T) => number,
): RepresentativeOfferSelection<T> | null {
  if (offers.length === 0) return null;

  const sorted = [...offers].sort((a, b) => priceOf(a) - priceOf(b));
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  const prices = sorted.map(priceOf);
  const mid = Math.floor(prices.length / 2);
  const medianValue =
    prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;

  // Floor selection: `sorted` is ascending, so the last entry at or below
  // the median value is the highest-priced offer that still clears the
  // "typical" bar without exceeding it.
  let median = sorted[0];
  for (const offer of sorted) {
    if (priceOf(offer) <= medianValue) median = offer;
    else break;
  }

  const unique: T[] = [];
  for (const candidate of [lowest, median, highest]) {
    if (!unique.includes(candidate)) unique.push(candidate);
  }

  return { lowest, median, highest, unique };
}
