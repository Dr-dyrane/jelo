'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import { ShareButton } from '@/components/share/share-button';
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

type LibraryView = 'all' | 'high' | 'gentle';

const evidenceLabel = {
  high: 'High evidence',
  moderate: 'Moderate evidence',
  emerging: 'Early evidence',
  insufficient: 'Not enough evidence',
};

const skinLabel = {
  generally_safe: 'Usually gentle',
  use_with_caution: 'Go slowly',
  avoid: 'Avoid on sensitive skin',
  unknown: 'Sensitivity unknown',
};

const views: Array<{ id: LibraryView; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High evidence' },
  { id: 'gentle', label: 'Usually gentle' },
];

function concentration(value: number | undefined, productName: string) {
  if (value === undefined || productName.includes(`${value}%`)) return '';
  return `${value}% `;
}

function productCountLabel(count: number) {
  return `${count} source-checked ${count === 1 ? 'product' : 'products'}`;
}

export function IngredientExplorer({ ingredients }: { ingredients: IngredientCard[] }) {
  const dialogId = useId();
  const { dialogRef, triggerRef, open, close } = useModalDialog();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<LibraryView>('all');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const normalized = query.trim().toLowerCase();
  const selected = ingredients.find(ingredient => ingredient.slug === openSlug) ?? null;
  const counts = useMemo(() => ({
    all: ingredients.length,
    high: ingredients.filter(ingredient => ingredient.evidenceGrade === 'high').length,
    gentle: ingredients.filter(ingredient => ingredient.sensitiveSkinStatus === 'generally_safe').length,
  }), [ingredients]);
  const visible = useMemo(() => ingredients.filter(ingredient => {
    const matchesView = view === 'all'
      || (view === 'high' && ingredient.evidenceGrade === 'high')
      || (view === 'gentle' && ingredient.sensitiveSkinStatus === 'generally_safe');
    if (!matchesView) return false;
    if (!normalized) return true;
    return [
      ingredient.name,
      ingredient.inciName,
      ingredient.summary,
      ...ingredient.products.flatMap(product => [product.brand, product.name]),
    ].join(' ').toLowerCase().includes(normalized);
  }), [ingredients, normalized, view]);
  const hasFilters = Boolean(normalized) || view !== 'all';

  function showIngredient(slug: string, opener: HTMLButtonElement) {
    triggerRef.current = opener;
    setOpenSlug(slug);
    window.requestAnimationFrame(open);
  }

  function closeIngredient() {
    close();
    setOpenSlug(null);
  }

  function resetLibrary() {
    setQuery('');
    setView('all');
  }

  return (
    <section className={styles.explorer} aria-label="Ingredient library">
      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Search ingredients</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ingredient or product" />
          {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear ingredient search"><X size={16} aria-hidden="true" /></button> : null}
        </label>

        <div className={styles.views} role="group" aria-label="Filter ingredients">
          {views.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}>
            {item.label}<span>{counts[item.id]}</span>
          </button>)}
        </div>
      </div>

      <div className={styles.resultBar}>
        <p role="status" aria-live="polite" aria-atomic="true"><strong>{visible.length}</strong> {visible.length === 1 ? 'ingredient' : 'ingredients'} shown</p>
        {hasFilters ? <button type="button" onClick={resetLibrary}>Clear</button> : null}
      </div>

      {visible.length ? <div className={styles.grid}>
        {visible.map(ingredient => <article className={styles.card} id={ingredient.slug} key={ingredient.slug}>
          <div className={styles.cardTop}>
            <p>{evidenceLabel[ingredient.evidenceGrade]}</p>
            <span data-status={ingredient.sensitiveSkinStatus}>{skinLabel[ingredient.sensitiveSkinStatus]}</span>
          </div>
          <div className={styles.cardCopy}>
            <h2>{ingredient.name}</h2>
            {ingredient.inciName !== ingredient.name ? <p className={styles.inci}>{ingredient.inciName}</p> : null}
            <p className={styles.summary}>{ingredient.summary}</p>
          </div>
          <div className={styles.cardFooter}>
            <span>{productCountLabel(ingredient.products.length)}</span>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-controls={dialogId}
              aria-expanded={openSlug === ingredient.slug}
              onClick={event => showIngredient(ingredient.slug, event.currentTarget)}
            >
              View <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </article>)}
      </div> : <div className={styles.empty}>
        <p>No match</p>
        <h2>Try another name.</h2>
        <button type="button" onClick={resetLibrary}>Show all ingredients</button>
      </div>}

      <dialog
        className={styles.dialog}
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        tabIndex={-1}
        onClose={() => setOpenSlug(null)}
        onCancel={() => setOpenSlug(null)}
        onKeyDownCapture={event => {
          if (event.key === 'Escape' && dialogRef.current?.dataset.fallbackModal === 'true') {
            event.preventDefault();
            event.stopPropagation();
            closeIngredient();
          }
        }}
        onClick={event => { if (event.target === dialogRef.current) closeIngredient(); }}
      >
        {selected ? <div className={styles.sheet}>
          <span className={styles.handle} aria-hidden="true" />
          <header className={styles.sheetHeader}>
            <div>
              <p>Ingredient guide</p>
              <h2 id={`${dialogId}-title`}>{selected.name}</h2>
              {selected.inciName !== selected.name ? <span>{selected.inciName}</span> : null}
            </div>
            <button type="button" onClick={closeIngredient} aria-label={`Close ${selected.name} guide`}><X size={20} aria-hidden="true" /></button>
          </header>

          <div className={styles.sheetBody}>
            <p className={styles.sheetSummary}>{selected.summary}</p>
            <dl className={styles.signals}>
              <div><dt>Evidence</dt><dd>{evidenceLabel[selected.evidenceGrade]}</dd></div>
              <div><dt>Sensitive skin</dt><dd>{skinLabel[selected.sensitiveSkinStatus]}</dd></div>
            </dl>

            <section className={styles.productSection} aria-labelledby={`${dialogId}-products`}>
              <div className={styles.productHeading}>
                <h3 id={`${dialogId}-products`}>Found in</h3>
                <span>{productCountLabel(selected.products.length)}</span>
              </div>
              <div className={styles.products}>
                {selected.products.map(product => <article className={styles.product} key={product.slug}>
                  <Link href={`/products/${product.slug}`} onClick={closeIngredient}>
                    <span>{product.brand}</span>
                    <strong>{concentration(product.concentrationPercent, product.name)}{product.name}</strong>
                  </Link>
                  <a href={product.sourceUrl} target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} aria-hidden="true" /></a>
                </article>)}
              </div>
            </section>

            <div className={styles.sheetFoot}>
              <p className={styles.sheetNote}>Evidence describes the ingredient, not the whole formula.</p>
              <ShareButton path={`/share/ingredient/${selected.slug}`} title={selected.name} label="Share" inline />
            </div>
          </div>
        </div> : null}
      </dialog>
    </section>
  );
}
