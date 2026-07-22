'use client';

import { ArrowUpRight, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Offer } from '@/data/products';
import type { Market } from '@/data/prices';
import { rankOffers } from '@/modules/commerce/rank-offers';

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

export function RetailerList({ offers, productSlug }: { offers: Offer[]; productSlug: string }) {
  // Nigeria is deliberately the first product-page market. JeloCare should show
  // local buying intelligence before asking shoppers to consider international routes.
  const [market, setMarket] = useState<Market>('NG');
  const ranked = useMemo(() => rankOffers(offers, market), [offers, market]);
  const visible = ranked.filter(offer => offer.match !== 'search' && (offer.location.includes(market) || offer.location.includes('INTL')));

  return (
    <div className="retailer-panel">
      <div className="retailer-market">
        <span><MapPin size={15}/> Shopping in</span>
        <div role="group" aria-label="Shopping market">
          <button className={market === 'NG' ? 'active' : ''} type="button" onClick={() => setMarket('NG')}>Nigeria</button>
          <button className={market === 'US' ? 'active' : ''} type="button" onClick={() => setMarket('US')}>United States</button>
        </div>
      </div>
      <div className="retailer-list">
        {visible.length ? visible.map((offer, index) => {
          const price = market === 'NG' ? offer.priceNgn : offer.priceUsd;
          const checked = shortDate(offer.checkedAt);
          return (
          <a
            key={`${offer.retailer}-${offer.url}`}
            className={`retailer-row ${offer.available ? '' : 'retailer-row-unavailable'}`}
            href={`/go?product=${encodeURIComponent(productSlug)}&retailer=${encodeURIComponent(offer.retailer)}`}
          >
            <span className="retailer-rank">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <strong>{offer.retailer}</strong>
              <small>{offer.available ? 'In stock' : 'Out of stock'}{checked ? ` · Checked ${checked}` : ''}</small>
            </span>
            <span className="retailer-price">
              <strong>{price ? (market === 'NG' ? formatNaira.format(price) : formatDollars.format(price)) : 'Check price'}</strong>
              <small>{price ? 'Exact match' : 'Not yet verified'}</small>
            </span>
            <ArrowUpRight className="retailer-arrow" size={19}/>
          </a>
          );
        }) : <div className="retailer-empty"><p>No exact offer yet.</p><button type="button" onClick={() => setMarket(market === 'NG' ? 'US' : 'NG')}>Try {market === 'NG' ? 'United States' : 'Nigeria'}</button></div>}
      </div>
    </div>
  );
}
