export type PriceObservation = {
  offerId: string;
  retailer: string;
  priceMinor: number;
  observedAt: string;
};

export type PriceMovement = {
  days: 7 | 30;
  direction: 'down' | 'flat' | 'up';
  amountMinor: number;
  percent: number;
  comparableOfferCount: number;
  fromAt: string;
  toAt: string;
};

export type MarketPriceTrends = {
  sevenDay: PriceMovement | null;
  thirtyDay: PriceMovement | null;
};

export type ProductPriceTrends = Partial<Record<'NG' | 'US', MarketPriceTrends>>;

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

export function calculatePriceTrends(observations: PriceObservation[], asOf = new Date()): MarketPriceTrends {
  return {
    sevenDay: movementForWindow(observations, 7, asOf),
    thirtyDay: movementForWindow(observations, 30, asOf),
  };
}
