'use client';

import { CircleCheck, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import feedbackStyles from '@/app/(site)/products/catalogue-feedback.module.css';
import { catalogueTransitionMessage } from '@/lib/catalogue/catalogue-interactions';
import { getCatalogueTransitionSnapshot, subscribeCatalogueTransition } from './catalogue-transition-tracker';
import styles from './filter-feedback-actions.module.css';

type AppliedFilter = {
  key: string;
  label: string;
  href: string;
};

type Props = {
  appliedFilters: AppliedFilter[];
  clearHref: string;
  currentHref: string;
  total: number;
};

export function CatalogueFilterFeedback({ appliedFilters, clearHref, currentHref, total }: Props) {
  const transition = useSyncExternalStore(
    subscribeCatalogueTransition,
    () => getCatalogueTransitionSnapshot(currentHref),
    () => null,
  );

  useEffect(() => {
    if (!transition) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('catalogue-results-heading')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [transition]);

  if (!appliedFilters.length && !transition) return null;
  const message = catalogueTransitionMessage(transition);
  const resultLabel = `${total.toLocaleString()} ${total === 1 ? 'result' : 'results'}`;
  const canUndo = Boolean(transition && transition.kind !== 'undo');

  return <div className={feedbackStyles.filterFeedback}>
    <p className="sr-only" role="status" aria-live="polite">{transition ? `${message} ${resultLabel}.` : ''}</p>
    <CircleCheck size={19} strokeWidth={1.8} aria-hidden="true"/>
    <div className={feedbackStyles.feedbackSummary}><strong>{message}</strong><span>{resultLabel}</span></div>
    {appliedFilters.length ? <div className={feedbackStyles.filterChips}>{appliedFilters.map(filter => <Link href={filter.href} key={filter.key} aria-label={`Remove ${filter.label} filter`}>{filter.label}<X size={13} aria-hidden="true"/></Link>)}</div> : null}
    <div className={styles.actions}>
      {canUndo && transition ? <Link data-catalogue-transition-kind="undo" href={`${transition.from}#all-products`}><RotateCcw size={14} aria-hidden="true"/> Undo</Link> : null}
      {appliedFilters.length ? <Link className={styles.clear} href={clearHref}>Clear all</Link> : null}
    </div>
  </div>;
}
