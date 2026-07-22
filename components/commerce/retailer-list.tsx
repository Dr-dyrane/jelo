'use client';

import { ArrowUpRight, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Offer } from '@/data/products';
import type { Market } from '@/data/prices';
import { rankOffers } from '@/modules/commerce/rank-offers';
import { summarizeMarket } from '@/modules/commerce/market-summary';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';
import {
  hasBrandAuthorizationEvidence,
  hasListingEvidence,
  hasSellerIdentityEvidence,
  landedCostCaveat,
  observedMarketPrice,
} from '@/modules/commerce/offer-evidence';
import type { ProductPriceTrends } from '@/modules/commerce/price-trends';

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

function shortDate(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function formatAmount(value: number, market: Market) {
  return market === 'NG' ? formatNaira.format(value) : formatDollars.format(value);
}

function movementLabel(trends: ProductPriceTrends | undefined, market: Market) {
  const movement = trends?.[market]?.thirtyDay ?? trends?.[market]?.sevenDay;
  if (!movement) return null;
  if (movement.direction === 'flat') return { direction: 'flat', copy: `Steady · ${movement.days}d` };
  const majorAmount = Math.abs(movement.amountMinor) / (market === 'US' ? 100 : 1);
  return {
    direction: movement.direction,
    copy: `${movement.direction === 'down' ? 'Down' : 'Up'} ${formatAmount(majorAmount, market)} · ${movement.days}d`,
  };
}

export function RetailerList({ offers, productSlug, priceTrends }: { offers: Offer[]; productSlug: string; priceTrends?: ProductPriceTrends }) {
  // Nigeria is deliberately the first product-page market. JeloCare should show
  // local buying intelligence before asking shoppers to consider international routes.
  const [market, setMarket] = useState<Market>('NG');
  const ranked = useMemo(() => rankOffers(offers, market), [offers, market]);
  const visible = ranked.filter(offer => offer.match !== 'search'
    && hasListingEvidence(offer)
    && (offer.location.includes(market) || offer.location.includes('INTL')));
  const summary = useMemo(() => summarizeMarket(offers, market), [offers, market]);
  const movement = movementLabel(priceTrends, market);

  return (
    <div className="retailer-panel">
      <div className="retailer-market">
        <span><MapPin size={15}/> Shopping in</span>
        <div role="group" aria-label="Shopping market">
          <button className={market === 'NG' ? 'active' : ''} type="button" onClick={() => setMarket('NG')}>Nigeria</button>
          <button className={market === 'US' ? 'active' : ''} type="button" onClick={() => setMarket('US')}>United States</button>
        </div>
      </div>
      {summary.retailerCount ? <div className="market-summary" aria-label={`${market === 'NG' ? 'Nigeria' : 'United States'} market summary`}>
        <span><small>{summary.priceBasis === 'multi-source' ? 'Lowest observed' : 'Observed'}</small><strong>{summary.lowestPrice == null ? 'Pending' : formatAmount(summary.lowestPrice, market)}</strong></span>
        {summary.typicalPrice != null && summary.typicalPrice !== summary.lowestPrice ? <span><small>Median</small><strong>{formatAmount(summary.typicalPrice, market)}</strong></span> : null}
        <span><small>Compared</small><strong>{summary.pricedRetailerCount} {summary.pricedRetailerCount === 1 ? 'store' : 'stores'}</strong></span>
        {summary.savingsVsTypical || movement ? <div className="market-summary-notes">
          {summary.savingsVsTypical ? <span>{formatAmount(summary.savingsVsTypical, market)} below this set&apos;s median.</span> : null}
          {movement ? <span className={`market-movement-${movement.direction}`}>{movement.copy}</span> : null}
        </div> : null}
      </div> : null}
      <div className="retailer-list">
        {visible.length ? visible.map((offer, index) => {
          const fresh = isOfferFresh(offer);
          const price = observedMarketPrice(offer, market);
          const checked = shortDate(offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt ?? offer.checkedAt);
          const stock = !fresh ? 'Check stock' : offer.available
            ? offer.inventoryQuantity ? `${offer.inventoryQuantity} left` : 'In stock'
            : 'Out of stock';
          return (
          <a
            key={`${offer.retailer}-${offer.url}`}
            className={`retailer-row ${offer.available && fresh ? '' : 'retailer-row-unavailable'}`}
            href={`/go?product=${encodeURIComponent(productSlug)}&retailer=${encodeURIComponent(offer.retailer)}`}
          >
            <span className="retailer-rank">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <strong>{offer.retailer}</strong>
              <small>{stock}{checked ? ` · Observed ${checked}` : ''}</small>
              {offer.priceObservation ? <small>{offer.priceObservation.size} · {landedCostCaveat(offer)}</small> : null}
              {offer.sellerName ? <small className="retailer-seller">Sold by {offer.sellerName}{offer.sellerScore ? ` · ${offer.sellerScore}%` : ''} · {hasSellerIdentityEvidence(offer) ? 'identity checked' : 'identity not checked'}</small> : null}
              {offer.retailerEvidence?.reviewStatus === 'provisional' ? <small>Provisional source · link only</small> : null}
              {hasBrandAuthorizationEvidence(offer) ? <small>Brand authorization evidenced</small> : null}
            </span>
            <span className="retailer-price">
              <strong>{price != null ? formatAmount(price, market) : 'Check price'}</strong>
              <small>{price != null
                ? offer.priceComparison === 'exclude' ? 'Marketplace price' : 'Observed price'
                : 'Price not current'}</small>
              {offer.priceComparison === 'exclude' ? <small>Not in comparison</small> : null}
            </span>
            <ArrowUpRight className="retailer-arrow" size={19}/>
          </a>
          );
        }) : <div className="retailer-empty"><p>No exact offer yet.</p><button type="button" onClick={() => setMarket(market === 'NG' ? 'US' : 'NG')}>Try {market === 'NG' ? 'United States' : 'Nigeria'}</button></div>}
      </div>
      <p className="retailer-disclosure">Listings and prices are observations, not authenticity guarantees. Delivery can change the total.</p>
    </div>
  );
}
