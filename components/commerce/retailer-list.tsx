'use client';

import { ArrowUpRight, MapPin } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import type { Offer, OrderChannel } from '@/data/products';
import type { Market } from '@/data/prices';
import {
  offerActionLabel,
  offerFulfilmentLabel,
  offerOrderChannels,
  orderChannelLabel,
} from '@/modules/commerce/offer-channel';
import { rankOffers } from '@/modules/commerce/rank-offers';
import { summarizeMarket } from '@/modules/commerce/market-summary';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';
import {
  hasBrandAuthorizationEvidence,
  hasListingEvidence,
  hasSellerIdentityEvidence,
  observedStockLabel,
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
  if (movement.direction === 'flat') return { direction: 'flat', copy: 'Price steady' };
  const majorAmount = Math.abs(movement.amountMinor) / (market === 'US' ? 100 : 1);
  return {
    direction: movement.direction,
    copy: `Price ${movement.direction === 'down' ? 'dropped' : 'rose'} ${formatAmount(majorAmount, market)}`,
  };
}

export function RetailerList({ offers, productSlug, priceTrends, footer }: { offers: Offer[]; productSlug: string; priceTrends?: ProductPriceTrends; footer?: ReactNode }) {
  // Nigeria is deliberately the first product-page market. JeloCare should show
  // local buying intelligence before asking shoppers to consider international routes.
  const [market, setMarket] = useState<Market>('NG');
  const [channel, setChannel] = useState<'all' | OrderChannel>('all');
  const ranked = useMemo(() => rankOffers(offers, market), [offers, market]);
  const visible = ranked.filter(offer => offer.match !== 'search'
    && hasListingEvidence(offer)
    && (offer.location.includes(market) || offer.location.includes('INTL')));
  const channels = [...new Set(visible.flatMap(offerOrderChannels))];
  const activeChannel = channel === 'all' || channels.includes(channel) ? channel : 'all';
  const filtered = activeChannel === 'all'
    ? visible
    : visible.filter(offer => offerOrderChannels(offer).includes(activeChannel));
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
        <span><small>{summary.priceBasis === 'multi-source' ? 'Best price' : 'Price'}</small><strong>{summary.lowestPrice == null ? 'Pending' : formatAmount(summary.lowestPrice, market)}</strong></span>
        {summary.typicalPrice != null && summary.typicalPrice !== summary.lowestPrice ? <span><small>Average</small><strong>{formatAmount(summary.typicalPrice, market)}</strong></span> : null}
        <span><small>Stores</small><strong>{summary.pricedRetailerCount}</strong></span>
        {summary.savingsVsTypical || movement ? <div className="market-summary-notes">
          {summary.savingsVsTypical ? <span>Save {formatAmount(summary.savingsVsTypical, market)}.</span> : null}
          {movement ? <span className={`market-movement-${movement.direction}`}>{movement.copy}</span> : null}
        </div> : null}
      </div> : null}
      {channels.length > 1 ? <div className="retailer-channel-filter" role="group" aria-label="Order channel">
        <button className={activeChannel === 'all' ? 'active' : ''} type="button" onClick={() => setChannel('all')}>All</button>
        {channels.map(value => <button
          className={activeChannel === value ? 'active' : ''}
          key={value}
          type="button"
          onClick={() => setChannel(value)}
        >{orderChannelLabel(value)}</button>)}
      </div> : null}
      <div className="retailer-list">
        {filtered.length ? filtered.map((offer, index) => {
          const fresh = isOfferFresh(offer);
          const price = observedMarketPrice(offer, market);
          const checked = shortDate(offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt ?? offer.checkedAt);
          const stock = observedStockLabel(offer, fresh);
          const fulfilment = offerFulfilmentLabel(offer);
          return (
          <a
            key={`${offer.retailer}-${offer.url}`}
            className={`retailer-row ${offer.available && fresh ? '' : 'retailer-row-unavailable'}`}
            href={`/go?product=${encodeURIComponent(productSlug)}&retailer=${encodeURIComponent(offer.retailer)}`}
          >
            <span className="retailer-rank">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <strong>{offer.retailer}</strong>
              <small>{stock}{checked ? ` · ${checked}` : ''}</small>
              {fulfilment ? <small>{fulfilment}</small> : null}
              {offer.priceObservation ? <small>{offer.priceObservation.size}</small> : null}
              {offer.sellerName ? <small className="retailer-seller">Sold by {offer.sellerName}{offer.sellerScore ? ` · ${offer.sellerScore}%` : ''}{hasSellerIdentityEvidence(offer) ? '' : ' · Check seller'}</small> : null}
              {offer.retailerEvidence?.reviewStatus === 'provisional' ? <small>Check with store</small> : null}
              {hasBrandAuthorizationEvidence(offer) ? <small>Listed by the brand</small> : null}
            </span>
            <span className="retailer-price">
              <strong>{price != null ? formatAmount(price, market) : 'Check price'}</strong>
              <small>{offerActionLabel(offer)}</small>
            </span>
            <ArrowUpRight className="retailer-arrow" size={19}/>
          </a>
          );
        }) : <div className="retailer-empty"><p>No exact offer yet.</p><button type="button" onClick={() => setMarket(market === 'NG' ? 'US' : 'NG')}>Try {market === 'NG' ? 'United States' : 'Nigeria'}</button></div>}
      </div>
      <div className="retailer-foot">
        <p className="retailer-disclosure">Prices can change. Delivery may cost extra.</p>
        {footer}
      </div>
    </div>
  );
}
