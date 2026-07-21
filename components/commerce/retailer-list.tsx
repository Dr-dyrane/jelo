'use client';

import { ArrowUpRight, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Offer } from '@/data/products';
import { inferMarket, type Market } from '@/data/prices';
import { rankOffers } from '@/modules/commerce/rank-offers';

export function RetailerList({ offers, productSlug }: { offers: Offer[]; productSlug: string }) {
  const [market, setMarket] = useState<Market>(() => inferMarket());
  const ranked = useMemo(() => rankOffers(offers, market), [offers, market]);
  const visible = ranked.filter(offer => offer.location.includes(market) || offer.location.includes('INTL'));

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
        {visible.length ? visible.map((offer, index) => (
          <a key={offer.url} className="retailer-row" href={`/go?product=${encodeURIComponent(productSlug)}&retailer=${encodeURIComponent(offer.retailer)}`}>
            <span className="retailer-rank">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <strong>{offer.retailer}</strong>
              <small>{offer.available ? offer.reasons[0] ?? 'Available for this market' : 'Check stock before purchase'}</small>
            </span>
            <ArrowUpRight className="retailer-arrow" size={19}/>
          </a>
        )) : <div className="retailer-empty"><p>No verified route is available for this market yet.</p><button type="button" onClick={() => setMarket(market === 'NG' ? 'US' : 'NG')}>Check the other market</button></div>}
      </div>
    </div>
  );
}
