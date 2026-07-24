import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { hasListingEvidence } from '@/modules/commerce/offer-evidence';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';
import { summarizeMarket } from '@/modules/commerce/market-summary';
import type { ShareOffer, ShareView } from './share-card';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export type ShareData = {
  view: ShareView;
  headlineLead: string;
  headlineEmph: string | null;
  storeCount: number;
};

/**
 * Builds the share view from the same verified offer data the product page uses:
 * fresh, exact, evidence-bound Nigerian offers only. Returns null when a product
 * cannot make an honest price card, so a share page never invents a number.
 */
export async function buildShareData(slug: string): Promise<ShareData | null> {
  const product = await findCatalogueProduct(slug);
  if (!product) return null;

  const offers = product.offers
    .filter(offer =>
      offer.match !== 'search'
      && hasListingEvidence(offer)
      && offer.location.includes('NG')
      && isOfferFresh(offer)
      && offer.priceNgn != null)
    .sort((a, b) => (a.priceNgn as number) - (b.priceNgn as number));
  if (offers.length === 0) return null;

  const summary = summarizeMarket(product.offers, 'NG');
  const lowest = offers[0].priceNgn as number;
  const highest = offers[offers.length - 1].priceNgn as number;
  const spread = offers.length >= 2 ? highest - lowest : null;
  const observedIso = summary.lastCheckedAt ?? offers[0].checkedAt ?? offers[0].priceObservation?.observedAt;
  const observedDate = observedIso ? shortDate.format(new Date(observedIso)) : 'recently';

  const shareOffers: ShareOffer[] = offers.map((offer, index) => {
    const stock = offer.priceObservation?.stock;
    const stockLabel = stock === 'low-stock' ? 'Low stock'
      : stock === 'out-of-stock' ? 'Out of stock'
        : stock === 'in-stock' ? 'In stock' : null;
    const dateLabel = offer.checkedAt ? shortDate.format(new Date(offer.checkedAt)) : observedDate;
    return {
      retailer: offer.retailer,
      priceLabel: naira.format(offer.priceNgn as number),
      goHref: `/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}`,
      when: stockLabel ? `${stockLabel} · ${dateLabel}` : dateLabel,
      isLowest: index === 0,
      isMarketplace: Boolean(offer.orderChannels?.includes('marketplace')),
    };
  });

  const view: ShareView = {
    productSlug: product.slug,
    brand: product.brand,
    name: product.name,
    microtag: `${product.size} · ${product.category}`,
    image: product.image,
    observedDate,
    spreadLabel: spread != null ? naira.format(spread) : null,
    storeCount: offers.length,
    offers: shareOffers,
  };

  return {
    view,
    headlineLead: spread != null ? 'Same product.' : `${product.brand} ${product.name}`,
    headlineEmph: spread != null ? `${naira.format(spread)} apart.` : null,
    storeCount: offers.length,
  };
}
