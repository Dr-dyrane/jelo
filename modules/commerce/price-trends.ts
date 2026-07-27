import type { Market } from '@/data/prices';
import type { Offer } from '@/data/products';
import { observedMarketPrice } from './offer-evidence';
import { isOfferFresh } from './offer-freshness';

export type PriceObservation = {
  offerId: string;
  retailer: string;
  priceMinor: number;
  observedAt: string;
};

export type PriceTrendOfferSnapshot = {
  market: 'NG' | 'US';
  retailer: string;
  url: string;
  priceMinor: number;
  currencyCode: 'NGN' | 'USD';
  observedAt: string;
  observedTitle: string;
  observedSize: string;
};

export type CurrentPriceObservation = PriceObservation & {
  market: 'NG' | 'US';
  url: string;
  available: boolean;
  inventoryStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  verificationMethod: 'manual' | 'retailer_page' | 'api' | 'import';
  lastVerifiedAt: string | null;
  verificationExpiresAt: string | null;
  observedTitle: string | null;
  observedSize: string | null;
  currentPriceMinor: number | null;
  currentCurrencyCode: string | null;
};

export type PriceMovement = {
  days: number;
  direction: 'down' | 'flat' | 'up';
  amountMinor: number;
  percent: number;
  /**
   * Legacy compatibility field. Calculated movements now admit only one
   * unambiguous exact offer per retailer, so this equals the retailer count.
   */
  comparableOfferCount: number;
  /** Distinct retailers represented by the market comparison. */
  comparableRetailerCount?: number;
  fromAt: string;
  toAt: string;
};

export type MarketPriceTrends = {
  recent?: PriceMovement | null;
  sevenDay: PriceMovement | null;
  thirtyDay: PriceMovement | null;
};

export type OfferPriceTrends = MarketPriceTrends & {
  offerId: string;
  retailer: string;
};

export type ProductPriceTrends = Partial<Record<'NG' | 'US', MarketPriceTrends>> & {
  byOffer?: Partial<Record<'NG' | 'US', OfferPriceTrends[]>>;
};

export function preferredPriceMovement(
  trends?: MarketPriceTrends,
  accepts: (movement: PriceMovement) => boolean = () => true,
): PriceMovement | null {
  return [
    trends?.thirtyDay,
    trends?.sevenDay,
    trends?.recent,
  ].find((movement): movement is PriceMovement => Boolean(movement && accepts(movement))) ?? null;
}

export function selectRetailerPriceMovement(
  trends: ProductPriceTrends | undefined,
  market: 'NG' | 'US',
  retailer?: string,
): PriceMovement | null {
  if (!retailer) return null;
  const key = retailer.trim().toLocaleLowerCase('en-NG');
  const matches = trends?.byOffer?.[market]?.filter(
    item => item.retailer.trim().toLocaleLowerCase('en-NG') === key,
  ) ?? [];

  // The public offer card is retailer-level while history is exact-offer-level.
  // Never attach one listing's movement to a different listing from the same store.
  if (matches.length !== 1) return null;
  return preferredPriceMovement(
    matches[0],
    movement => movement.direction !== 'flat',
  );
}

export function describePriceMovement(
  movement: PriceMovement,
  subject: string,
) {
  const amount = Math.abs(movement.percent);
  const value = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1);
  const direction = movement.direction === 'flat' ? 'steady' : movement.direction;
  const dayUnit = movement.days === 1 ? 'day' : 'days';
  const retailerCount = movement.comparableRetailerCount ?? movement.comparableOfferCount;
  return `${subject} ${direction} over ${movement.days} ${dayUnit}${
    movement.direction === 'flat' ? '' : ` by ${value} percent`
  }. Based on ${retailerCount} ${
    retailerCount === 1 ? 'matching store' : 'matching stores'
  }.`;
}

/**
 * Compact visual notation for dense buying surfaces.
 *
 * Flat movement stays quiet: a steady label adds noise without helping someone
 * choose. The full evidence sentence remains available through
 * `describePriceMovement` for accessible names and tooltips.
 */
export function compactPriceMovementLabel(
  movement: PriceMovement | null | undefined,
) {
  if (!movement || movement.direction === 'flat') return null;
  const amount = Math.abs(movement.percent);
  const value = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1);
  const arrow = movement.direction === 'down' ? '↓' : '↑';
  return `${arrow} ${value}% · ${movement.days}d`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizedRetailer(value: string) {
  return value.trim().toLocaleLowerCase('en-NG');
}

function normalizedOfferUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function expectedCurrency(market: 'NG' | 'US') {
  return market === 'NG' ? 'NGN' : 'USD';
}

function normalizedTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function priceTrendOfferSnapshot(
  offer: Offer,
  market: Market,
  now: number | Date = Date.now(),
): PriceTrendOfferSnapshot | null {
  const price = observedMarketPrice(offer, market, now);
  const observation = offer.priceObservation;
  const observedAt = normalizedTimestamp(observation?.observedAt);
  const priceMinor = market === 'US' ? Math.round((price ?? 0) * 100) : price;
  const currencyCode = expectedCurrency(market);

  if (
    price == null
    || !observation
    || !observedAt
    || !observation.variant.trim()
    || !observation.size.trim()
    || typeof priceMinor !== 'number'
    || !Number.isSafeInteger(priceMinor)
    || priceMinor <= 0
  ) return null;

  return {
    market,
    retailer: offer.retailer,
    url: offer.url,
    priceMinor,
    currencyCode,
    observedAt,
    observedTitle: observation.variant.trim(),
    observedSize: observation.size.trim(),
  };
}

/**
 * Intersects history with the exact offer snapshot rendered by the caller and
 * the current persisted offer state repeated on each history row.
 *
 * History is deliberately rejected when the DB listing has since become stale,
 * unavailable, incomplete, or changed URL. This prevents a current card from
 * borrowing movement from a different or no-longer-buyable listing.
 */
export function selectCurrentPriceObservations(
  rows: CurrentPriceObservation[],
  snapshot: readonly PriceTrendOfferSnapshot[] | undefined,
  asOf: number | Date = Date.now(),
): PriceObservation[] {
  const current = typeof asOf === 'number' ? new Date(asOf) : asOf;
  if (Number.isNaN(current.getTime()) || !snapshot?.length) return [];

  const snapshotEntries = snapshot.flatMap(item => {
    const url = normalizedOfferUrl(item.url);
    const retailer = normalizedRetailer(item.retailer);
    const observedAt = normalizedTimestamp(item.observedAt);
    const title = item.observedTitle.trim();
    const size = item.observedSize.trim();
    const expected = expectedCurrency(item.market);
    return (
      url
      && retailer
      && observedAt
      && title
      && size
      && item.currencyCode === expected
      && Number.isSafeInteger(item.priceMinor)
      && item.priceMinor > 0
    ) ? [[
      `${item.market}\u0000${retailer}\u0000${url}`,
      { ...item, observedAt, observedTitle: title, observedSize: size },
    ] as const] : [];
  });
  const allowed = new Map<string, PriceTrendOfferSnapshot>();
  for (const [key, item] of snapshotEntries) {
    // One rendered store card must bind one exact series. Ambiguous snapshots
    // fail closed instead of allowing array order to select a price identity.
    if (allowed.has(key)) return [];
    allowed.set(key, item);
  }
  if (allowed.size === 0) return [];

  const candidates = rows.flatMap(row => {
    const url = normalizedOfferUrl(row.url);
    const retailer = normalizedRetailer(row.retailer);
    const key = url && retailer ? `${row.market}\u0000${retailer}\u0000${url}` : null;
    const expected = key ? allowed.get(key) : undefined;
    const currentPrice = row.currentPriceMinor;
    const currentObservedAt = normalizedTimestamp(row.lastVerifiedAt);
    const hasCurrentEvidence = row.available
      && (row.inventoryStatus === 'in_stock' || row.inventoryStatus === 'low_stock')
      && ['manual', 'retailer_page', 'api'].includes(row.verificationMethod)
      && Boolean(row.observedTitle?.trim())
      && Boolean(row.observedSize?.trim())
      && typeof currentPrice === 'number'
      && Number.isFinite(currentPrice)
      && currentPrice > 0
      && row.currentCurrencyCode?.trim() === expectedCurrency(row.market)
      && isOfferFresh({
        checkedAt: row.lastVerifiedAt ?? undefined,
        expiresAt: row.verificationExpiresAt ?? undefined,
      }, current);

    if (
      !expected
      || !hasCurrentEvidence
      || currentPrice !== expected.priceMinor
      || row.currentCurrencyCode !== expected.currencyCode
      || currentObservedAt !== expected.observedAt
      || row.observedTitle?.trim() !== expected.observedTitle
      || row.observedSize?.trim() !== expected.observedSize
    ) return [];

    return [{
      snapshot: expected,
      observation: {
        offerId: row.offerId,
        retailer: row.retailer,
        priceMinor: row.priceMinor,
        observedAt: row.observedAt,
      },
    }];
  });

  const byOffer = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const offerId = candidate.observation.offerId;
    byOffer.set(offerId, [...(byOffer.get(offerId) ?? []), candidate]);
  }

  return [...byOffer.values()].flatMap(entries => {
    const ordered = [...entries].sort(
      (a, b) => Date.parse(a.observation.observedAt) - Date.parse(b.observation.observedAt),
    );
    const latest = ordered.at(-1);
    if (!latest) return [];

    const latestAt = normalizedTimestamp(latest.observation.observedAt);
    if (
      latest.observation.priceMinor !== latest.snapshot.priceMinor
      || latestAt !== latest.snapshot.observedAt
    ) return [];

    return ordered.map(entry => entry.observation);
  });
}

type ComparablePair = {
  anchor: PriceObservation;
  current: PriceObservation;
};

/**
 * A retailer contributes at most one exact series to a market movement. If two
 * offer IDs claim the same retailer, neither is safe to attach to its one public
 * store row, so that retailer fails closed instead of receiving extra weight.
 */
function unambiguousRetailerPairs(pairs: ComparablePair[]) {
  const byRetailer = new Map<string, ComparablePair[]>();
  for (const pair of pairs) {
    const anchorRetailer = normalizedRetailer(pair.anchor.retailer);
    const currentRetailer = normalizedRetailer(pair.current.retailer);
    if (!currentRetailer || anchorRetailer !== currentRetailer) continue;
    byRetailer.set(currentRetailer, [...(byRetailer.get(currentRetailer) ?? []), pair]);
  }
  return [...byRetailer.values()].flatMap(entries => entries.length === 1 ? entries : []);
}

function movementForWindow(observations: PriceObservation[], days: 7 | 30, asOf: Date): PriceMovement | null {
  const cutoff = asOf.getTime() - days * 86_400_000;
  const toleranceDays = days === 7 ? 7 : 15;
  const oldestAnchor = cutoff - toleranceDays * 86_400_000;
  const freshestCurrent = asOf.getTime() - 8 * 86_400_000;
  const grouped = new Map<string, PriceObservation[]>();

  for (const observation of observations) {
    if (!Number.isFinite(observation.priceMinor) || observation.priceMinor <= 0) continue;
    const timestamp = Date.parse(observation.observedAt);
    if (!Number.isFinite(timestamp) || timestamp > asOf.getTime()) continue;
    grouped.set(observation.offerId, [...(grouped.get(observation.offerId) ?? []), observation]);
  }

  const offerPairs = [...grouped.values()].flatMap(entries => {
    const ordered = entries.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const current = ordered.at(-1);
    if (!current || Date.parse(current.observedAt) < freshestCurrent) return [];
    const anchor = ordered.filter(entry => {
      const time = Date.parse(entry.observedAt);
      return time <= cutoff && time >= oldestAnchor;
    }).at(-1);
    return anchor ? [{ anchor, current }] : [];
  });
  const comparable = unambiguousRetailerPairs(offerPairs);

  if (!comparable.length) return null;
  const anchorMedian = median(comparable.map(pair => pair.anchor.priceMinor));
  const currentMedian = median(comparable.map(pair => pair.current.priceMinor));
  if (anchorMedian <= 0) return null;
  const amountMinor = Math.round(currentMedian - anchorMedian);
  const percent = Number((((currentMedian - anchorMedian) / anchorMedian) * 100).toFixed(1));
  const direction = Math.abs(percent) < 0.5 ? 'flat' : percent < 0 ? 'down' : 'up';
  const fromAt = comparable.map(pair => pair.anchor.observedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const toAt = comparable.map(pair => pair.current.observedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    days,
    direction,
    amountMinor,
    percent,
    comparableOfferCount: comparable.length,
    comparableRetailerCount: comparable.length,
    fromAt,
    toAt,
  };
}

function movementSinceLastCheck(
  observations: PriceObservation[],
  asOf: Date,
): PriceMovement | null {
  const latestAllowed = asOf.getTime();
  const freshestCurrent = latestAllowed - 8 * 86_400_000;
  const grouped = new Map<string, PriceObservation[]>();

  for (const observation of observations) {
    if (!Number.isFinite(observation.priceMinor) || observation.priceMinor <= 0) continue;
    const timestamp = Date.parse(observation.observedAt);
    if (!Number.isFinite(timestamp) || timestamp > latestAllowed) continue;
    grouped.set(observation.offerId, [...(grouped.get(observation.offerId) ?? []), observation]);
  }

  const offerPairs = [...grouped.values()].flatMap(entries => {
    const ordered = entries.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const current = ordered.at(-1);
    if (!current || Date.parse(current.observedAt) < freshestCurrent) return [];

    const currentTime = Date.parse(current.observedAt);
    const oldestAnchor = currentTime - 14 * 86_400_000;
    const anchor = ordered.slice(0, -1).reverse().find(entry => {
      const time = Date.parse(entry.observedAt);
      return time >= oldestAnchor && currentTime - time >= 12 * 3_600_000;
    });

    return anchor ? [{ anchor, current }] : [];
  });
  const comparable = unambiguousRetailerPairs(offerPairs);

  if (!comparable.length) return null;
  const anchorMedian = median(comparable.map(pair => pair.anchor.priceMinor));
  const currentMedian = median(comparable.map(pair => pair.current.priceMinor));
  if (anchorMedian <= 0) return null;

  const amountMinor = Math.round(currentMedian - anchorMedian);
  const percent = Number((((currentMedian - anchorMedian) / anchorMedian) * 100).toFixed(1));
  const direction = Math.abs(percent) < 0.5 ? 'flat' : percent < 0 ? 'down' : 'up';
  const fromAt = comparable
    .map(pair => pair.anchor.observedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const toAt = comparable
    .map(pair => pair.current.observedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const elapsedDays = median(comparable.map(pair => (
    (Date.parse(pair.current.observedAt) - Date.parse(pair.anchor.observedAt)) / 86_400_000
  )));

  return {
    days: Math.max(1, Math.round(elapsedDays)),
    direction,
    amountMinor,
    percent,
    comparableOfferCount: comparable.length,
    comparableRetailerCount: comparable.length,
    fromAt,
    toAt,
  };
}

export function calculatePriceTrends(observations: PriceObservation[], asOf = new Date()): MarketPriceTrends {
  return {
    recent: movementSinceLastCheck(observations, asOf),
    sevenDay: movementForWindow(observations, 7, asOf),
    thirtyDay: movementForWindow(observations, 30, asOf),
  };
}

export function calculateOfferPriceTrends(
  observations: PriceObservation[],
  asOf = new Date(),
): OfferPriceTrends[] {
  const grouped = new Map<string, PriceObservation[]>();

  for (const observation of observations) {
    grouped.set(observation.offerId, [...(grouped.get(observation.offerId) ?? []), observation]);
  }

  return [...grouped.entries()].flatMap(([offerId, entries]) => {
    const trends = calculatePriceTrends(entries, asOf);
    if (!trends.recent && !trends.sevenDay && !trends.thirtyDay) return [];

    const latest = [...entries].sort(
      (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt),
    )[0];

    return [{
      offerId,
      retailer: latest.retailer,
      ...trends,
    }];
  });
}
