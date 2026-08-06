import 'server-only';

import type { Offer, Product } from '@/data/products';
import { isOfferFresh } from './offer-freshness';
import { hasListingEvidence, comparableMarketPrice } from './offer-evidence';
import { summarizeMarket } from './market-summary';
import {
  compactPriceMovementLabel,
  type ProductPriceTrends,
} from './price-trends';
import { hasShareableNgOffer } from './shareable-offer';

// --- Thresholds ---

const RISE_MIN_PERCENT = 4;
const RISE_LIMIT = 6;
const DROP_MIN_PERCENT = 4;
const DROP_LIMIT = 6;
const OOS_LIMIT = 12;

// --- Types ---

export type MarketTrendMovement = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  microtag: string;
  amountNaira: number;
  percent: number;
  days: 7 | 30;
  lowestNaira: number | null;
  trendLabel: string;
  comparableStoreCount: number;
  observedAt: string;
};

export type MarketTrendOutOfStock = {
  slug: string;
  brand: string;
  name: string;
  image: string;
  microtag: string;
  retailer: string;
  url: string;
  observedAt: string | null;
};

export type MarketTrendsReadModel = {
  summary: {
    productCount: number;
    offerCount: number;
    storeCount: number;
    pricedCount: number;
    outOfStockCount: number;
  };
  priceDrops: MarketTrendMovement[];
  priceIncreases: MarketTrendMovement[];
  outOfStockAlerts: MarketTrendOutOfStock[];
};

// --- Helpers ---

const microtag = (product: Product) => `${product.size} · ${product.category}`;

function servesNg(offer: Offer) {
  return offer.location.includes('NG') || offer.location.includes('INTL');
}

function selectMovements(
  items: Array<{ product: Product; trends: ProductPriceTrends }>,
  now: number | Date,
  direction: 'down' | 'up',
  minPercent: number,
  limit: number,
): MarketTrendMovement[] {
  const results: MarketTrendMovement[] = [];

  for (const { product, trends } of items) {
    if (!hasShareableNgOffer(product, now)) continue;
    const movement = [
      trends.NG?.thirtyDay,
      trends.NG?.sevenDay,
    ].find(candidate => (
      candidate?.direction === direction
      && Math.abs(candidate.percent) >= minPercent
      && (candidate.comparableRetailerCount ?? 0) >= 2
    ));
    if (!movement) continue;
    const comparableStoreCount = movement.comparableRetailerCount ?? 0;
    const trendLabel = compactPriceMovementLabel(movement);
    if (!trendLabel) continue;
    const summary = summarizeMarket(product.offers, 'NG', now);
    results.push({
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      image: product.image,
      microtag: microtag(product),
      amountNaira: Math.abs(movement.amountMinor),
      percent: movement.percent,
      days: movement.days === 30 ? 30 : 7,
      lowestNaira: summary.lowestPrice,
      trendLabel,
      comparableStoreCount,
      observedAt: movement.toAt,
    });
  }

  return results.sort((a, b) => (
    Math.abs(b.percent) - Math.abs(a.percent)
    || b.comparableStoreCount - a.comparableStoreCount
    || Date.parse(b.observedAt) - Date.parse(a.observedAt)
    || b.amountNaira - a.amountNaira
  )).slice(0, limit);
}

function selectOutOfStockAlerts(
  products: Product[],
  now: number | Date,
  limit: number,
): MarketTrendOutOfStock[] {
  const alerts: MarketTrendOutOfStock[] = [];

  for (const product of products) {
    const exactOffers = product.offers.filter(offer =>
      offer.match !== 'search'
      && servesNg(offer)
      && hasListingEvidence(offer)
      && isOfferFresh(offer, now)
    );
    for (const offer of exactOffers) {
      if (!offer.available) {
        const observedAt = offer.priceObservation?.observedAt
          ?? offer.listingEvidence?.observedAt
          ?? offer.checkedAt
          ?? null;
        alerts.push({
          slug: product.slug,
          brand: product.brand,
          name: product.name,
          image: product.image,
          microtag: microtag(product),
          retailer: offer.retailer,
          url: offer.url,
          observedAt,
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    const aTime = a.observedAt ? Date.parse(a.observedAt) : 0;
    const bTime = b.observedAt ? Date.parse(b.observedAt) : 0;
    return bTime - aTime;
  }).slice(0, limit);
}

// --- Public API ---

export type MarketTrendsOptions = {
  now?: number | Date;
  totalProductCount?: number;
};

export async function buildMarketTrendsReadModel(
  productsPromise: Promise<readonly Product[]>,
  trendsPromise: Promise<ReadonlyMap<string, ProductPriceTrends>>,
  options: MarketTrendsOptions = {},
): Promise<MarketTrendsReadModel> {
  const now = options.now ?? Date.now();
  const products = (await productsPromise).filter(product => hasShareableNgOffer(product, now));
  const trends = await trendsPromise;

  const items = products.map(product => ({
    product,
    trends: trends.get(product.slug) ?? {},
  }));

  const priceDrops = selectMovements(items, now, 'down', DROP_MIN_PERCENT, DROP_LIMIT);
  const priceIncreases = selectMovements(items, now, 'up', RISE_MIN_PERCENT, RISE_LIMIT);
  const outOfStockAlerts = selectOutOfStockAlerts(products, now, OOS_LIMIT);

  // Summary stats
  let offerCount = 0;
  let pricedCount = 0;
  let outOfStockCount = 0;
  const storeSet = new Set<string>();

  for (const product of products) {
    const exactOffers = product.offers.filter(offer =>
      offer.match !== 'search'
      && servesNg(offer)
      && hasListingEvidence(offer)
      && isOfferFresh(offer, now)
    );
    offerCount += exactOffers.length;
    for (const offer of exactOffers) {
      storeSet.add(offer.retailer.trim().toLowerCase());
      if (!offer.available) {
        outOfStockCount += 1;
      } else if (comparableMarketPrice(offer, 'NG', now) != null) {
        pricedCount += 1;
      }
    }
  }

  return {
    summary: {
      productCount: options.totalProductCount ?? products.length,
      offerCount,
      storeCount: storeSet.size,
      pricedCount,
      outOfStockCount,
    },
    priceDrops,
    priceIncreases,
    outOfStockAlerts,
  };
}
