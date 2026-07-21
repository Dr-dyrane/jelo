'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '@/data/products';
import type { Market } from '@/data/prices';
import { ProductGrid } from './product-grid';
import styles from './catalogue-explorer.module.css';

type Category = 'All' | Product['category'];

const categories: Category[] = ['All', 'Face', 'Hair', 'Body'];
const featuredConcerns = ['acne', 'dark spots', 'sensitivity', 'dryness', 'oiliness', 'dandruff', 'barrier'];

export function CatalogueExplorer({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [concern, setConcern] = useState('');
  const [market, setMarket] = useState<Market>('NG');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter(product => {
      const searchable = [product.brand, product.name, product.step, product.displayLine, ...product.bestFor, ...product.concerns, ...product.skinTypes].join(' ').toLowerCase();
      const matchesQuery = !normalized || searchable.includes(normalized);
      const matchesCategory = category === 'All' || product.category === category;
      const matchesConcern = !concern || product.concerns.some(value => value.includes(concern) || concern.includes(value));
      const matchesMarket = product.offers.some(offer => offer.available && (offer.location.includes(market) || offer.location.includes('INTL')));
      return matchesQuery && matchesCategory && matchesConcern && matchesMarket;
    });
  }, [products, query, category, concern, market]);

  const hasFilters = Boolean(query || concern || category !== 'All');
  const clearFilters = () => { setQuery(''); setCategory('All'); setConcern(''); };

  return (
    <section className={styles.explorer}>
      <div className={styles.commandBar}>
        <label className={styles.search}>
          <Search size={19} aria-hidden="true" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search product, brand, ingredient or concern" aria-label="Search catalogue" />
          {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/></button> : null}
        </label>
        <div className={styles.market} aria-label="Shopping market">
          <button type="button" className={market === 'NG' ? styles.active : ''} onClick={() => setMarket('NG')}>Nigeria</button>
          <button type="button" className={market === 'US' ? styles.active : ''} onClick={() => setMarket('US')}>United States</button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span><SlidersHorizontal size={15}/> Category</span>
          <div>{categories.map(value => <button type="button" key={value} className={category === value ? styles.selected : ''} onClick={() => setCategory(value)}>{value}</button>)}</div>
        </div>
        <div className={styles.filterGroup}>
          <span>Concern</span>
          <div>{featuredConcerns.map(value => <button type="button" key={value} className={concern === value ? styles.selected : ''} onClick={() => setConcern(concern === value ? '' : value)}>{value}</button>)}</div>
        </div>
      </div>

      <div className={styles.resultLine}>
        <p><strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'} available for {market === 'NG' ? 'Nigeria' : 'the United States'}</p>
        {hasFilters ? <button type="button" onClick={clearFilters}>Clear filters</button> : null}
      </div>

      {filtered.length ? <ProductGrid products={filtered}/> : (
        <div className={styles.empty}>
          <p className="eyebrow">Nothing exact yet</p>
          <h2>Try a broader concern.</h2>
          <p>Clear one filter or switch market to see the closest verified catalogue matches.</p>
          <button type="button" onClick={clearFilters}>Show available products</button>
        </div>
      )}
    </section>
  );
}
