'use client';

import { ArrowDown, ArrowUp, ArrowUpRight, BadgeCheck, MapPin, SlidersHorizontal, Truck } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import type { FulfilmentMethod, Offer, OrderChannel } from '@/data/products';
import type { Market } from '@/data/prices';
import { nigeriaRetailers } from '@/data/retailers';
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
  const [sort, setSort] = useState<'ranked' | 'trust' | 'price'>('ranked');
  const [showFilters, setShowFilters] = useState(false);
  const preferences = useMemo(() => (fulfilment === 'any' ? {} : { fulfilment }), [fulfilment]);
  const ranked = useMemo(() => rankOffers(offers, market, undefined, preferences), [offers, market, preferences]);
  const liveTrust = (offer: Offer) => nigeriaRetailers.find(r => r.name === offer.retailer)?.trust ?? offer.trust;
  const visible = ranked.filter(offer => offer.match !== 'search'
    && hasListingEvidence(offer)
    && (offer.location.includes(market) || offer.location.includes('INTL')));
  const channels = [...new Set(visible.flatMap(offerOrderChannels))];
  const activeChannel = channel === 'all' || channels.includes(channel) ? channel : 'all';
  const filtered = activeChannel === 'all'
    ? visible
    : visible.filter(offer => offerOrderChannels(offer).includes(activeChannel));
  const displayed = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'trust') arr.sort((a, b) => liveTrust(b) - liveTrust(a));
    if (sort === 'price') {
      const priceOf = (offer: Offer) => observedMarketPrice(offer, market) ?? Infinity;
      arr.sort((a, b) => priceOf(a) - priceOf(b));
    }
    return arr;
  }, [filtered, sort, market]);
  const fulfilments = [...new Set(visible.flatMap(offerFulfilmentMethods))];
  const activeFulfilment = fulfilment === 'any' || fulfilments.includes(fulfilment) ? fulfilment : 'any';

  // Use the server-owned market snapshot when available — one source of truth.
  // Fall back to deriving from offers only when no snapshot is passed (public pages).
  const snapshot = marketSnapshot?.[market];
  const reading = snapshot?.reading;
  const extras = snapshot?.extras;
  // Use numeric lowestPrice from extras — never parse the formatted priceLabel.
  const lowestPrice = extras?.lowestPrice ?? null;
  const pricedStoreCount = extras?.uniquePricedStoreCount ?? 0;
  const listingCount = extras?.uniqueListingStoreCount ?? 0;
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

  // Best match is the top-ranked offer — shown as a calm, distinct card.
  const bestMatch = displayed[0] ?? null;
  const restOffers = displayed.slice(1);
  const hasChannelOrFulfilmentFilters = channels.length > 1 || fulfilments.length > 1;

  function renderOfferRow(offer: Offer, index: number) {
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
          <small className="retailer-trust">Trust {liveTrust(offer)}</small>
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
  }

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

      {/* Sort controls — always visible when there are 2+ offers */}
      {filtered.length > 1 ? (
        <div className="retailer-market retailer-sort" role="group" aria-label="Sort stores">
          <span>Sort by</span>
          <div>
            <button className={sort === 'ranked' ? 'active' : ''} type="button" onClick={() => setSort('ranked')}>Best match</button>
            <button className={sort === 'trust' ? 'active' : ''} type="button" onClick={() => setSort('trust')}>Trust</button>
            <button className={sort === 'price' ? 'active' : ''} type="button" onClick={() => setSort('price')}>Price</button>
          </div>
        </div>
      ) : null}

      {/* Best match — the top-ranked offer with a verified badge */}
      {bestMatch ? (
        <div className="retailer-best-match" aria-label="JeloCare verified pick">
          <span className="retailer-pick-badge" aria-hidden="true">
            <BadgeCheck size={20} strokeWidth={2.2} />
          </span>
          {renderOfferRow(bestMatch, 0)}
        </div>
      ) : null}

      {/* Advanced filters — progressively disclosed */}
      {hasChannelOrFulfilmentFilters ? (
        <button
          type="button"
          className="retailer-filters-toggle"
          aria-expanded={showFilters}
          aria-controls="retailer-advanced-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={14} aria-hidden="true" /> {showFilters ? 'Hide filters' : 'More filters'}
        </button>
      ) : null}
      {showFilters && hasChannelOrFulfilmentFilters ? (
        <div id="retailer-advanced-filters" className="retailer-advanced-filters">
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
        </div>
      ) : null}

      {/* Remaining offers */}
      <div className="retailer-list">
        {restOffers.length ? restOffers.map((offer, index) => renderOfferRow(offer, index + 1)) : null}
        {displayed.length === 0 ? <div className="retailer-empty"><p>No exact offer yet.</p><button type="button" onClick={() => setMarket(market === 'NG' ? 'US' : 'NG')}>Try {market === 'NG' ? 'United States' : 'Nigeria'}</button></div> : null}
      </div>
      <div className="retailer-foot">
        <p className="retailer-disclosure">Prices can change. Delivery may cost extra.</p>
        {footer}
      </div>
    </div>
  );
}
