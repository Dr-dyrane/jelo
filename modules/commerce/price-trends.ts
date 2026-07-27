export type PriceObservation = {
  offerId: string;
  retailer: string;
  priceMinor: number;
  observedAt: string;
};

export type PriceMovement = {
  days: number;
  direction: 'down' | 'flat' | 'up';
  amountMinor: number;
  percent: number;
  comparableOfferCount: number;
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
): PriceMovement | null {
  return trends?.thirtyDay ?? trends?.sevenDay ?? trends?.recent ?? null;
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
  return preferredPriceMovement(matches[0]);
}

export function describePriceMovement(
  movement: PriceMovement,
  subject: string,
) {
  const amount = Math.abs(movement.percent);
  const value = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1);
  const direction = movement.direction === 'flat' ? 'steady' : movement.direction;
  const dayUnit = movement.days === 1 ? 'day' : 'days';
  return `${subject} ${direction} over ${movement.days} ${dayUnit}${
    movement.direction === 'flat' ? '' : ` by ${value} percent`
  }. Based on ${movement.comparableOfferCount} ${
    movement.comparableOfferCount === 1 ? 'matching store' : 'matching stores'
  }.`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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

  const comparable = [...grouped.values()].flatMap(entries => {
    const ordered = entries.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const current = ordered.at(-1);
    if (!current || Date.parse(current.observedAt) < freshestCurrent) return [];
    const anchor = ordered.filter(entry => {
      const time = Date.parse(entry.observedAt);
      return time <= cutoff && time >= oldestAnchor;
    }).at(-1);
    return anchor ? [{ anchor, current }] : [];
  });

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

  const comparable = [...grouped.values()].flatMap(entries => {
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
