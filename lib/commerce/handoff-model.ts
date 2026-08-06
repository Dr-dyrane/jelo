import 'server-only';

import type { Market } from '@/data/prices';
import type { Offer, Product } from '@/data/products';
import { retailerSearchUrl, nigeriaRetailers } from '@/data/retailers';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { rankOffers } from '@/modules/commerce/rank-offers';
import { buildProductMarketSnapshot } from '@/modules/commerce/product-market-snapshot';
import {
  hasBrandAuthorizationEvidence,
  hasListingEvidence,
  hasSellerIdentityEvidence,
  observedMarketPrice,
  observedStockLabel,
  comparableMarketPrice,
} from '@/modules/commerce/offer-evidence';
import { offerFreshnessDays } from '@/modules/commerce/price-rank';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';
import { offerActionLabel, offerFulfilmentLabel } from '@/modules/commerce/offer-channel';
import { buildAttributedUrl } from '@/modules/commerce/redirect-attribution';

export type HandoffOffer = {
  retailer: string;
  /** Attributed external URL with JeloCare tracking parameters */
  attributedUrl: string;
  /** Raw retailer URL (without attribution) */
  rawUrl: string;
  price: number | null;
  priceLabel: string;
  stockLabel: string;
  actionLabel: string;
  fulfilmentLabel: string | null;
  trust: number;
  /** True when seller identity evidence is missing — show "Check seller" */
  checkSeller: boolean;
  /** True when the retailer listing is provisional — show "Check with store" */
  checkWithStore: boolean;
  /** True when brand authorization evidence exists — show "Listed by the brand" */
  listedByBrand: boolean;
  /** True when seller name is available */
  sellerName: string | null;
  sellerScore: number | null;
  freshnessDays: number | null;
  observedAt: string | null;
  isLowest: boolean;
  isFresh: boolean;
  /** Search-only offer (no exact listing) */
  isSearchOnly: boolean;
};

export type HandoffModel = {
  productSlug: string;
  productName: string;
  productBrand: string;
  productImage: string;
  selectedOffer: HandoffOffer | null;
  alternativeOffers: HandoffOffer[];
  market: Market;
  /** Why this offer is shown — a factual explanation */
  reasonLabel: string;
  /** Market context */
  storeCount: number;
  lastCheckedAt: string | null;
};

const formatNaira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});
const formatDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function formatAmount(value: number, market: Market) {
  return market === 'NG' ? formatNaira.format(value) : formatDollars.format(value);
}

function shortDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function resolveMarket(offer: Offer): Market {
  return offer.location.includes('NG') ? 'NG' : offer.location.includes('US') ? 'US' : 'NG';
}

function buildOffer(
  offer: Offer,
  product: Product,
  market: Market,
  ranked: Offer[],
): HandoffOffer {
  const fresh = isOfferFresh(offer);
  const price = observedMarketPrice(offer, market);
  const observedAt = offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt ?? offer.checkedAt ?? null;
  const trust = nigeriaRetailers.find(r => r.name === offer.retailer)?.trust ?? offer.trust;
  const isSearchOnly = offer.match === 'search' || !hasListingEvidence(offer);
  // "Lowest observed" means the offer has the lowest comparable price across
  // all fresh, exact-listing offers in the same market — not just the top-ranked.
  const isLowest = (() => {
    if (isSearchOnly || price == null) return false;
    const competingPrices = ranked
      .filter(item => item.retailer !== offer.retailer && hasListingEvidence(item) && item.match !== 'search')
      .filter(item => item.location.includes(market) || item.location.includes('INTL'))
      .map(item => comparableMarketPrice(item, market))
      .filter((p): p is number => p != null);
    return competingPrices.length === 0 || price <= Math.min(...competingPrices);
  })();

  return {
    retailer: offer.retailer,
    attributedUrl: buildAttributedUrl(offer.url, { productSlug: product.slug, retailer: offer.retailer }),
    rawUrl: offer.url,
    price,
    priceLabel: price != null ? formatAmount(price, market) : 'Check price',
    stockLabel: observedStockLabel(offer, fresh),
    actionLabel: offerActionLabel(offer),
    fulfilmentLabel: offerFulfilmentLabel(offer),
    trust,
    checkSeller: offer.sellerName
      ? !hasSellerIdentityEvidence(offer)
      : nigeriaRetailers.find(r => r.name === offer.retailer)?.kind === 'marketplace',
    checkWithStore: offer.retailerEvidence?.reviewStatus === 'provisional',
    listedByBrand: hasBrandAuthorizationEvidence(offer),
    sellerName: offer.sellerName ?? null,
    sellerScore: offer.sellerScore ?? null,
    freshnessDays: offerFreshnessDays(offer),
    observedAt: shortDate(observedAt),
    isLowest,
    isFresh: fresh,
    isSearchOnly,
  };
}

/**
 * Resolves the complete handoff model for the trust bridge page.
 * Returns null when the product or retailer is not found.
 */
export async function resolveHandoff(
  productSlug: string,
  retailerName: string,
): Promise<HandoffModel | null> {
  const product = await findCatalogueProduct(productSlug);
  if (!product) return null;

  const offer = product.offers.find(item => item.retailer === retailerName);
  const market = offer ? resolveMarket(offer) : 'NG';
  const ranked = rankOffers(product.offers, market);
  const snapshot = buildProductMarketSnapshot(product.offers, Date.now());
  const marketSnapshot = snapshot[market];
  const storeCount = marketSnapshot?.extras?.uniquePricedStoreCount ?? 0;
  const lastCheckedAt = marketSnapshot?.reading?.state === 'priced' || marketSnapshot?.reading?.state === 'listing-only'
    ? marketSnapshot.reading.observedAt
    : null;

  // Build alternative offers (same market, excluding the selected retailer)
  const alternatives = ranked
    .filter(item => item.retailer !== retailerName && hasListingEvidence(item) && item.match !== 'search')
    .filter(item => item.location.includes(market) || item.location.includes('INTL'))
    .slice(0, 4)
    .map(altOffer => buildOffer(altOffer, product, market, ranked));

  let selectedOffer: HandoffOffer | null = null;
  let reasonLabel: string;

  if (offer) {
    selectedOffer = buildOffer(offer, product, market, ranked);
    if (selectedOffer.isSearchOnly) {
      reasonLabel = 'No exact listing observed. This is a search link to the retailer.';
    } else if (selectedOffer.isLowest) {
      reasonLabel = 'Lowest observed price among checked stores with exact listings.';
    } else {
      reasonLabel = 'One of the checked stores with an exact listing.';
    }
  } else {
    // No exact offer — build a search-only handoff
    const searchUrl = retailerSearchUrl(retailerName, `${product.brand} ${product.name} ${product.size}`);
    if (!searchUrl) return null;
    const trust = nigeriaRetailers.find(r => r.name === retailerName)?.trust ?? 50;
    selectedOffer = {
      retailer: retailerName,
      attributedUrl: buildAttributedUrl(searchUrl, { productSlug: product.slug, retailer: retailerName }),
      rawUrl: searchUrl,
      price: null,
      priceLabel: 'Check price',
      stockLabel: 'Check stock',
      actionLabel: 'Search store',
      fulfilmentLabel: null,
      trust,
      checkSeller: false,
      checkWithStore: false,
      listedByBrand: false,
      sellerName: null,
      sellerScore: null,
      freshnessDays: null,
      observedAt: null,
      isLowest: false,
      isFresh: false,
      isSearchOnly: true,
    };
    reasonLabel = 'No exact listing observed. This is a search link to the retailer.';
  }

  return {
    productSlug: product.slug,
    productName: product.name,
    productBrand: product.brand,
    productImage: product.image,
    selectedOffer,
    alternativeOffers: alternatives,
    market,
    reasonLabel,
    storeCount: Math.max(storeCount, alternatives.length + 1),
    lastCheckedAt: shortDate(lastCheckedAt),
  };
}

export type { Market };

