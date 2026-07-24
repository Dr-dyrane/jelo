import { after, NextResponse } from 'next/server';
import type { Market } from '@/data/prices';
import { retailerSearchUrl } from '@/data/retailers';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { recordStoreClick } from '@/lib/analytics/commerce-events';
import { buildAttributedUrl } from '@/modules/commerce/redirect-attribution';
import { rankOffers } from '@/modules/commerce/rank-offers';
import { summarizeMarket } from '@/modules/commerce/market-summary';
import { offerFreshnessDays, offerPriceRank } from '@/modules/commerce/price-rank';

export async function GET(request: Request) {
  const current = new URL(request.url);
  const productSlug = current.searchParams.get('product');
  const retailerName = current.searchParams.get('retailer');
  const product = productSlug ? await findCatalogueProduct(productSlug) : undefined;
  const offer = product?.offers.find(item => item.retailer === retailerName);
  if (!product) return NextResponse.redirect(new URL('/products', request.url));
  if (offer) {
    // store_click, recorded after the response so measurement never delays the
    // outbound redirect. priceRank comes from the same summary the page shows.
    const market: Market = offer.location.includes('NG') ? 'NG' : offer.location.includes('US') ? 'US' : 'NG';
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
    return NextResponse.redirect(buildAttributedUrl(offer.url, { productSlug: product.slug, retailer: offer.retailer }), 307);
  }

  const searchUrl = retailerName
    ? retailerSearchUrl(retailerName, `${product.brand} ${product.name} ${product.size}`)
    : undefined;
  if (!searchUrl || !retailerName) return NextResponse.redirect(new URL('/products', request.url));
  return NextResponse.redirect(buildAttributedUrl(searchUrl, { productSlug: product.slug, retailer: retailerName }), 307);
}
