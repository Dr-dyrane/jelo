import type { Offer } from '@/data/products';
import { rankOffers } from '@/modules/commerce/rank-offers';

export function RetailerList({ offers }: { offers: Offer[] }) {
  const ranked = rankOffers(offers, 'NG');
  return (
    <div className="retailer-list">
      {ranked.map((offer, index) => (
        <a key={offer.url} className="retailer-row" href={`/go?url=${encodeURIComponent(offer.url)}&retailer=${encodeURIComponent(offer.retailer)}`}>
          <span className="retailer-rank">{String(index + 1).padStart(2, '0')}</span>
          <span><strong>{offer.retailer}</strong><small>{offer.available ? 'Available' : 'Check stock'}</small></span>
          <span className="retailer-arrow">↗</span>
        </a>
      ))}
    </div>
  );
}
