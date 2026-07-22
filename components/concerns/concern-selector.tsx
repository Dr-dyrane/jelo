'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Check, Plus, RotateCcw } from 'lucide-react';
import { startTransition, useMemo, useOptimistic } from 'react';
import type { Concern } from '@/data/knowledge';
import type { Product } from '@/data/products';
import { ProductCard } from '@/components/products/product-card';
import { rankProductsForConcerns } from '@/modules/concerns/product-matching';
import styles from './concern-selector.module.css';

function selectedFromQuery(value: string | null, valid: Set<string>) {
  return (value ?? '').split(',').filter(slug => valid.has(slug));
}

export function ConcernSelector({ concerns, products }: { concerns: Concern[]; products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const valid = useMemo(() => new Set(concerns.map(concern => concern.slug)), [concerns]);
  const selectedFromUrl = useMemo(
    () => selectedFromQuery(searchParams.get('concerns'), valid),
    [searchParams, valid],
  );
  const [selected, setSelected] = useOptimistic(selectedFromUrl);

  const ranked = useMemo(
    () => rankProductsForConcerns(products, concerns, selected),
    [products, concerns, selected],
  );

  function update(next: string[]) {
    const query = new URLSearchParams(searchParams.toString());
    if (next.length) query.set('concerns', next.join(','));
    else query.delete('concerns');
    const suffix = query.toString();
    startTransition(() => {
      setSelected(next);
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    });
  }

  function toggle(slug: string) {
    update(selected.includes(slug) ? selected.filter(item => item !== slug) : [...selected, slug]);
  }

  return (
    <>
      <section className={styles.selector} aria-labelledby="concern-selector-title">
        <div className={styles.selectorHeading}>
          <div><p className="eyebrow">Your edit</p><h2 id="concern-selector-title">Choose what you notice.</h2></div>
          <p>Pick more than one.</p>
        </div>

        <div className={styles.rail} aria-label="Select concerns">
          {concerns.map((concern, index) => {
            const active = selected.includes(concern.slug);
            return <article className={`${styles.card} ${active ? styles.active : ''}`} key={concern.slug}>
              <button type="button" aria-pressed={active} onClick={() => toggle(concern.slug)}>
                <span className={styles.cardTop}><small>0{index + 1} · {concern.area}</small><span>{active ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}</span></span>
                <strong>{concern.name}</strong>
                <p>{concern.summary}</p>
              </button>
              <Link href={`/concerns/${concern.slug}`}>Guide <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </article>;
          })}
        </div>
      </section>

      <section className={styles.results} aria-live="polite">
        <div className={styles.resultsHeading}>
          <div><p className="eyebrow">Products</p><h2>{selected.length ? 'Your matches.' : 'Start with a concern.'}</h2></div>
          {selected.length ? <button type="button" onClick={() => update([])}><RotateCcw size={15} aria-hidden="true" /> Clear</button> : null}
        </div>

        {selected.length ? <>
          <p className={styles.resultCount}>{ranked.length} {ranked.length === 1 ? 'product' : 'products'} · {selected.length} selected</p>
          {ranked.length ? <div className={styles.productGrid}>{ranked.map(result => <div className={styles.productMatch} key={result.product.slug}>
            <span>Matches {result.matchedConcernSlugs.length} of {selected.length}</span>
            <ProductCard product={result.product}/>
          </div>)}</div> : <p className={styles.empty}>No direct match yet. Try one concern at a time.</p>}
        </> : <p className={styles.empty}>Choose one or more concerns above.</p>}
      </section>
    </>
  );
}
