'use client';

import { ArrowDown, ArrowUp, ArrowUpRight, MapPin, Truck } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import type { FulfilmentMethod, Offer, OrderChannel } from '@/data/products';
import type { Market } from '@/data/prices';
import {
  fulfilmentMethodLabel,
  offerActionLabel,
  offerFulfilmentLabel,
  offerFulfilmentMethods,
  offerOrderChannels,
  orderChannelLabel,
} from '@/modules/commerce/offer-channel';
import { rankOffers } from '@/modules/commerce/rank-offers';
import { isOfferFresh } from '@/modules/commerce/offer-freshness';
import type { ProductMarketSnapshot } from '@/modules/commerce/product-market-snapshot';
import {
  hasBrandAuthorizationEvidence,
  hasListingEvidence,
  hasSellerIdentityEvidence,
  observedDeliveryFee,
  observedStockLabel,
  observedMarketPrice,
} from '@/modules/commerce/offer-evidence';
import type {
  PriceMovement,
  ProductPriceTrends,
} from '@/modules/commerce/price-trends';
import {
  describePriceMovement,
  preferredPriceMovement,
  selectRetailerPriceMovement,
} from '@/modules/commerce/price-trends';

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

function PriceTrend({
  movement,
  subject,
}: {
  movement: PriceMovement | null;
  subject: string;
}) {
  if (!movement || movement.direction === 'flat') return null;

  const label = describePriceMovement(movement, subject);
  const Icon = movement.direction === 'down' ? ArrowDown : ArrowUp;

  return (
    <span
      className={`price-trend price-trend-${movement.direction}`}
      aria-label={label}
      title={label}
    >
      <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

export function RetailerList({ offers, productSlug, priceTrends, marketSnapshot, footer }: { offers: Offer[]; productSlug: string; priceTrends?: ProductPriceTrends; marketSnapshot?: ProductMarketSnapshot; footer?: ReactNode }) {
  // Nigeria is deliberately the first product-page market. JeloCare should show
  // local buying intelligence before asking shoppers to consider international routes.
  const [market, setMarket] = useState<Market>('NG');
  const [channel, setChannel] = useState<'all' | OrderChannel>('all');
  const [fulfilment, setFulfilment] = useState<'any' | FulfilmentMethod>('any');
  const preferences = useMemo(() => (fulfilment === 'any' ? {} : { fulfilment }), [fulfilment]);
  const ranked = useMemo(() => rankOffers(offers, market, undefined, preferences), [offers, market, preferences]);
  const visible = ranked.filter(offer => offer.match !== 'search'
    && hasListingEvidence(offer)
    && (offer.location.includes(market) || offer.location.includes('INTL')));
  const channels = [...new Set(visible.flatMap(offerOrderChannels))];
  const activeChannel = channel === 'all' || channels.includes(channel) ? channel : 'all';
  const filtered = activeChannel === 'all'
    ? visible
    : visible.filter(offer => offerOrderChannels(offer).includes(activeChannel));
  const fulfilments = [...new Set(visible.flatMap(offerFulfilmentMethods))];
  const activeFulfilment = fulfilment === 'any' || fulfilments.includes(fulfilment) ? fulfilment : 'any';

  // Use the server-owned market snapshot when available — one source of truth.
  // Fall back to deriving from offers only when no snapshot is passed (public pages).
  const snapshot = marketSnapshot?.[market];
  const reading = snapshot?.reading;
  const extras = snapshot?.extras;
  const lowestPrice = reading?.state === 'priced' ? parseFloat(reading.priceLabel.replace(/^[^\d]*/, '').replace(/,/g, '')) : null;
  const pricedStoreCount = extras?.pricedStoreCount ?? 0;
  const listingCount = extras?.listingCount ?? 0;
  const lastCheckedAt = reading?.state === 'priced' || reading?.state === 'listing-only' ? reading.observedAt : null;
  const priceBasis = reading?.state === 'priced' ? reading.basis : 'none';
  const typicalPrice = extras?.typicalPrice ?? null;
  const savings = extras?.savings ?? null;

  const marketMovement = preferredPriceMovement(priceTrends?.[market]);
  // Confidence, surfaced as compared-set coverage — never a grade (ADR 0006). Only
  // shown when some checked stores are unpriced, so the reader knows the summary
  // reflects a subset (out-of-stock or comparison-excluded stores are the gap).
  const coverageNote = pricedStoreCount > 0 && listingCount > pricedStoreCount
    ? `Based on ${pricedStoreCount} of ${listingCount} stores`
    : null;

  return (
    <div className="retailer-panel">
      <div className="retailer-market">
        <span><MapPin size={15}/> Shopping in</span>
        <div role="group" aria-label="Shopping market">
          <button className={market === 'NG' ? 'active' : ''} type="button" onClick={() => setMarket('NG')}>Nigeria</button>
          <button className={market === 'US' ? 'active' : ''} type="button" onClick={() => setMarket('US')}>United States</button>
        </div>
      </div>
      {listingCount ? <div className="market-summary" aria-label={`${market === 'NG' ? 'Nigeria' : 'United States'} market summary`}>
        <span>
          <small>{priceBasis === 'multi-source' ? 'Lowest observed' : 'Observed'}</small>
          <span className="market-price-line">
            <strong>{lowestPrice == null ? 'Pending' : formatAmount(lowestPrice, market)}</strong>
          </span>
        </span>
        {typicalPrice != null && typicalPrice !== lowestPrice ? <span>
          <small>Typical</small>
          <span className="market-price-line">
            <strong>{formatAmount(typicalPrice, market)}</strong>
            <PriceTrend movement={marketMovement} subject="Market price" />
          </span>
        </span> : null}
        <span><small>Stores</small><strong>{pricedStoreCount}</strong></span>
        {lastCheckedAt ? <span><small>Checked</small><strong>{shortDate(lastCheckedAt)}</strong></span> : null}
        {savings ? <div className="market-summary-notes">
          {savings ? <span>Save {formatAmount(savings, market)}.</span> : null}
        </div> : null}
      </div> : null}
      {coverageNote ? <p className="market-summary-coverage">{coverageNote}</p> : null}
      {channels.length > 1 ? <div className="retailer-channel-filter" role="group" aria-label="Order channel">
        <button className={activeChannel === 'all' ? 'active' : ''} type="button" onClick={() => setChannel('all')}>All</button>
        {channels.map(value => <button
          className={activeChannel === value ? 'active' : ''}
          key={value}
          type="button"
          onClick={() => setChannel(value)}
        >{orderChannelLabel(value)}</button>)}
      </div> : null}
      {fulfilments.length > 1 ? <div className="retailer-market retailer-fulfilment">
        <span><Truck size={15}/> Prefer</span>
        <div role="group" aria-label="Fulfilment preference">
          <button className={activeFulfilment === 'any' ? 'active' : ''} type="button" onClick={() => setFulfilment('any')}>Any</button>
          {fulfilments.map(method => <button
            className={activeFulfilment === method ? 'active' : ''}
            key={method}
            type="button"
            onClick={() => setFulfilment(method)}
          >{fulfilmentMethodLabel(method)}</button>)}
        </div>
      </div> : null}
      <div className="retailer-list">
        {filtered.length ? filtered.map((offer, index) => {
          const fresh = isOfferFresh(offer);
          const price = observedMarketPrice(offer, market);
          const checked = shortDate(offer.priceObservation?.observedAt ?? offer.listingEvidence?.observedAt ?? offer.checkedAt);
          const stock = observedStockLabel(offer, fresh);
          const fulfilmentText = offerFulfilmentLabel(offer);
          const deliveryFee = offer.priceObservation?.landedCost === 'excluded' ? observedDeliveryFee(offer, market) : null;
          const movement = selectRetailerPriceMovement(priceTrends, market, offer.retailer);
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
              {fulfilmentText ? <small>{fulfilmentText}</small> : null}
              {deliveryFee != null ? <small className="retailer-delivery">+{formatAmount(deliveryFee, market)} delivery</small> : null}
              {offer.priceObservation ? <small>{offer.priceObservation.size}</small> : null}
              {offer.sellerName ? <small className="retailer-seller">Sold by {offer.sellerName}{offer.sellerScore ? ` · ${offer.sellerScore}%` : ''}{hasSellerIdentityEvidence(offer) ? '' : ' · Check seller'}</small> : null}
              {offer.retailerEvidence?.reviewStatus === 'provisional' ? <small>Check with store</small> : null}
              {hasBrandAuthorizationEvidence(offer) ? <small>Listed by the brand</small> : null}
            </span>
            <span className="retailer-price">
              <span className="retailer-price-line">
                <strong>{price != null ? formatAmount(price, market) : 'Check price'}</strong>
                {price != null ? <PriceTrend movement={movement} subject={`${offer.retailer} price`} /> : null}
              </span>
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
