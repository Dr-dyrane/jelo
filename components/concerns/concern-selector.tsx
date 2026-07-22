'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowDown, ArrowUpRight, Check, CircleCheck, Plus, RotateCcw, Undo2 } from 'lucide-react';
import { startTransition, useMemo, useOptimistic, useRef, useState } from 'react';
import type { Concern } from '@/data/knowledge';
import type { Product } from '@/data/products';
import { ProductCard } from '@/components/products/product-card';
import { rankProductsForConcerns } from '@/modules/concerns/product-matching';
import styles from './concern-selector.module.css';
import feedbackStyles from './concern-feedback.module.css';

export function ConcernSelector({ concerns, products, initialSelected }: { concerns: Concern[]; products: Product[]; initialSelected: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useOptimistic(initialSelected);
  const [feedback, setFeedback] = useState<{ message: string; previous: string[] } | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const ranked = useMemo(
    () => rankProductsForConcerns(products, concerns, selected),
    [products, concerns, selected],
  );

  function update(next: string[], message: string, previous = selected) {
    const query = new URLSearchParams(window.location.search);
    if (next.length) query.set('concerns', next.join(','));
    else query.delete('concerns');
    const suffix = query.toString();
    startTransition(() => {
      setSelected(next);
      setFeedback({ message, previous: [...previous] });
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    });
  }

  function toggle(slug: string) {
    const concern = concerns.find(item => item.slug === slug);
    const active = selected.includes(slug);
    const next = active ? selected.filter(item => item !== slug) : [...selected, slug];
    update(next, `${concern?.name ?? 'Concern'} ${active ? 'removed' : 'selected'}.`);
  }

  function undo() {
    if (!feedback) return;
    update(feedback.previous, 'Last change undone.', selected);
  }

  function viewMatches() {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultsRef.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <section className={styles.selector} aria-labelledby="concern-selector-title">
        <div className={styles.selectorHeading}>
          <div><p className="eyebrow">Your edit</p><h2 id="concern-selector-title">Pick yours.</h2></div>
        </div>

        <div className={styles.rail} aria-label="Select concerns">
          {concerns.map((concern, index) => {
            const active = selected.includes(concern.slug);
            return <article className={`${styles.card} ${active ? styles.active : ''}`} key={concern.slug}>
              <button type="button" aria-pressed={active} onClick={() => toggle(concern.slug)}>
                <span className={styles.cardTop}><small>{String(index + 1).padStart(2, '0')} · {concern.area}</small><span>{active ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}</span></span>
                <strong>{concern.name}</strong>
                <p>{concern.summary}</p>
              </button>
              <Link href={`/concerns/${concern.slug}`}>Guide <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </article>;
          })}
        </div>
        {feedback ? <div className={feedbackStyles.feedback} role="status" aria-live="polite">
          <CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />
          <div><strong>{feedback.message}</strong><span>{selected.length} selected · {ranked.length} matches</span></div>
          <div className={feedbackStyles.actions}>
            {selected.length ? <button type="button" onClick={viewMatches}>View matches <ArrowDown size={14} aria-hidden="true" /></button> : null}
            <button type="button" onClick={undo}><Undo2 size={14} aria-hidden="true" /> Undo</button>
            {selected.length ? <button type="button" onClick={() => update([], 'Selections cleared.')}>Clear</button> : null}
          </div>
        </div> : null}
      </section>

      {selected.length ? <section className={`${styles.results} ${feedbackStyles.results}`} ref={resultsRef} tabIndex={-1}>
        <div className={styles.resultsHeading}>
          <div><p className="eyebrow">Products</p><h2>Your matches.</h2></div>
          <button type="button" onClick={() => update([], 'Selections cleared.')}><RotateCcw size={15} aria-hidden="true" /> Clear</button>
        </div>

        <p className={styles.resultCount}>{ranked.length} {ranked.length === 1 ? 'product' : 'products'} · {selected.length} selected</p>
        {ranked.length ? <div className={styles.productGrid}>{ranked.map(result => <div className={styles.productMatch} key={result.product.slug}>
          <span>Matches {result.matchedConcernSlugs.length} of {selected.length}</span>
          <ProductCard product={result.product}/>
        </div>)}</div> : <p className={styles.empty}>No care-cleared product yet.</p>}
      </section> : null}
    </>
  );
}
