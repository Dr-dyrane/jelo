import { ArrowUpRight } from 'lucide-react';
import { nigeriaRetailers } from '@/data/retailers';

export function StoreSearches({ productSlug, exactRetailers }: { productSlug: string; exactRetailers: string[] }) {
  const exact = new Set(exactRetailers);
  const stores = nigeriaRetailers.filter(store => !exact.has(store.name));

  return (
    <details className="store-searches">
      <summary>Search {stores.length} more Nigerian stores</summary>
      <div>
        {stores.map(store => (
          <a key={store.name} href={`/go?product=${encodeURIComponent(productSlug)}&retailer=${encodeURIComponent(store.name)}`}>
            <span><strong>{store.name}</strong><small>{store.kind === 'marketplace' ? 'Marketplace' : 'Retailer'}</small></span>
            <ArrowUpRight size={17}/>
          </a>
        ))}
      </div>
    </details>
  );
}
