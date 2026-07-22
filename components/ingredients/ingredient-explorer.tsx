'use client';

import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import styles from './ingredient-explorer.module.css';

export type IngredientProduct = {
  slug: string;
  brand: string;
  name: string;
  concentrationPercent?: number;
  sourceUrl: string;
};

export type IngredientCard = {
  slug: string;
  name: string;
  inciName: string;
  summary: string;
  evidenceGrade: 'high' | 'moderate' | 'emerging' | 'insufficient';
  sensitiveSkinStatus: 'generally_safe' | 'use_with_caution' | 'avoid' | 'unknown';
  products: IngredientProduct[];
};

const evidenceLabel = {
  high: 'High evidence',
  moderate: 'Good evidence',
  emerging: 'Early evidence',
  insufficient: 'Not enough evidence',
};

const skinLabel = {
  generally_safe: 'Usually gentle',
  use_with_caution: 'Go slowly',
  avoid: 'Avoid on sensitive skin',
  unknown: 'Sensitivity unknown',
};

function concentration(value: number | undefined, productName: string) {
  if (value === undefined || productName.includes(`${value}%`)) return '';
  return `${value}% `;
}

export function IngredientExplorer({ ingredients }: { ingredients: IngredientCard[] }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => ingredients.filter(ingredient => {
    if (!normalized) return true;
    return [
      ingredient.name,
      ingredient.inciName,
      ingredient.summary,
      ...ingredient.products.flatMap(product => [product.brand, product.name]),
    ].join(' ').toLowerCase().includes(normalized);
  }), [ingredients, normalized]);

  return (
    <section className={styles.explorer} aria-label="Ingredient library">
      <label className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search ingredients</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ingredient or product" />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear ingredient search"><X size={16}/></button> : null}
      </label>

      <p className={styles.count}><strong>{visible.length}</strong> {visible.length === 1 ? 'ingredient' : 'ingredients'}</p>

      {visible.length ? <div className={styles.grid}>
        {visible.map(ingredient => <article className={styles.card} id={ingredient.slug} key={ingredient.slug}>
          <div className={styles.cardTop}>
            <p className="eyebrow">{evidenceLabel[ingredient.evidenceGrade]}</p>
            <span>{skinLabel[ingredient.sensitiveSkinStatus]}</span>
          </div>
          <h2>{ingredient.name}</h2>
          {ingredient.inciName !== ingredient.name ? <p className={styles.inci}>{ingredient.inciName}</p> : null}
          <p className={styles.summary}>{ingredient.summary}</p>
          <div className={styles.products}>
            <p>Found in</p>
            {ingredient.products.map(product => <div className={styles.product} key={product.slug}>
              <Link href={`/products/${product.slug}`}>
                <span>{product.brand}</span>
                <strong>{concentration(product.concentrationPercent, product.name)}{product.name}</strong>
              </Link>
              <a href={product.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
            </div>)}
          </div>
        </article>)}
      </div> : <div className={styles.empty}>
        <p className="eyebrow">No exact match</p>
        <h2>Try another name.</h2>
        <button type="button" onClick={() => setQuery('')}>Show all ingredients</button>
      </div>}
    </section>
  );
}
