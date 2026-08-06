import { after, NextResponse } from 'next/server';
import type { Market } from '@/data/prices';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { recordStoreClick } from '@/lib/analytics/commerce-events';
import { recordHandoffEvent } from '@/lib/analytics/handoff-events';
import { buildAttributedUrl } from '@/modules/commerce/redirect-attribution';
import { rankOffers } from '@/modules/commerce/rank-offers';
import { summarizeMarket } from '@/modules/commerce/market-summary';
import { offerFreshnessDays, offerPriceRank } from '@/modules/commerce/price-rank';
import { retailerSearchUrl } from '@/data/retailers';

/**
 * Continue route — the actual outbound redirect.
 *
 * The trust bridge page links here when the user deliberately clicks
 * "Continue to retailer". This route records both the handoff_continue
 * event and the existing store_click event, then redirects.
 *
 * If the product or retailer is missing, redirect to the catalogue
 * rather than showing an error — the user should never be stuck.
 */
export async function GET(request: Request) {
  const current = new URL(request.url);
  const productSlug = current.searchParams.get('product');
  const retailerName = current.searchParams.get('retailer');
  const product = productSlug ? await findCatalogueProduct(productSlug) : undefined;
  const offer = product?.offers.find(item => item.retailer === retailerName);

  if (!product || !retailerName) {
    return NextResponse.redirect(new URL('/products', request.url));
  }

  const market: Market = offer
    ? offer.location.includes('NG') ? 'NG' : offer.location.includes('US') ? 'US' : 'NG'
    : 'NG';

  // Record handoff_continue event (best-effort, never blocks)
  after(() => recordHandoffEvent({
    productSlug: product.slug,
    retailer: retailerName,
    market,
    interaction: 'continue',
  }));

  if (offer) {
    // Record the existing store_click event (same as before)
    const ranked = rankOffers(product.offers, market);
    const position = Math.min(200, Math.max(1, ranked.findIndex(item => item.retailer === offer.retailer && item.url === offer.url) + 1));
    const summary = summarizeMarket(product.offers, market);
    after(() => recordStoreClick({
      productSlug: product.slug,
      retailer: offer.retailer,
      market,
      priceNgn: market === 'NG' && typeof offer.priceNgn === 'number' && offer.priceNgn > 0 ? offer.priceNgn : null,
      priceRank: offerPriceRank(offer, summary, market),
      position,
      freshnessDays: offerFreshnessDays(offer),
    }));

    return NextResponse.redirect(
      buildAttributedUrl(offer.url, { productSlug: product.slug, retailer: offer.retailer }),
      307,
    );
  }

  // No exact offer — redirect to retailer search
  const searchUrl = retailerSearchUrl(retailerName, `${product.brand} ${product.name} ${product.size}`);
  if (!searchUrl) return NextResponse.redirect(new URL(`/products/${product.slug}`, request.url));
  return NextResponse.redirect(
    buildAttributedUrl(searchUrl, { productSlug: product.slug, retailer: retailerName }),
    307,
  );
}
