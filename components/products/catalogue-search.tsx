'use client';

import { ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { recordCatalogueTransition } from './catalogue-transition-tracker';
import {
  matchingCatalogueSearchSuggestions,
  type CatalogueSearchSuggestion,
  type CatalogueSearchSuggestionKind,
} from './catalogue-search-suggestions';
import styles from './catalogue-search.module.css';

const kindLabels: Record<CatalogueSearchSuggestionKind, string> = {
  product: 'Product',
  company: 'Company',
  category: 'Category',
  guide: 'Guide',
};

type Props = {
  defaultValue: string;
  market: 'NG' | 'US';
  marketHrefs: Record<'NG' | 'US', string>;
  suggestions: CatalogueSearchSuggestion[];
};

export function CatalogueSearch({ defaultValue, market, marketHrefs, suggestions }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = `${useId().replace(/:/g, '')}-catalogue-suggestions`;
  const matches = useMemo(
    () => matchingCatalogueSearchSuggestions(suggestions, value),
    [suggestions, value],
  );
  const currentActiveIndex = activeIndex >= 0 && activeIndex < matches.length ? activeIndex : -1;
  const showSuggestions = expanded && matches.length > 0;

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  function openSuggestions() {
    setExpanded(true);
  }

  function closeSuggestions() {
    setExpanded(false);
    setActiveIndex(-1);
  }

  function followSuggestion(suggestion: CatalogueSearchSuggestion) {
    closeSuggestions();
    if (suggestion.href.startsWith('/products?')) recordCatalogueTransition(suggestion.href);
    router.push(suggestion.href);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const suggestion = showSuggestions && currentActiveIndex >= 0 ? matches[currentActiveIndex] : null;
    if (!suggestion) return;
    event.preventDefault();
    followSuggestion(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && showSuggestions && currentActiveIndex >= 0) {
      event.preventDefault();
      followSuggestion(matches[currentActiveIndex]);
      return;
    }
    if (event.key === 'Escape') {
      if (expanded) {
        event.preventDefault();
        closeSuggestions();
      }
      return;
    }
    if (event.key === 'Tab') {
      closeSuggestions();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setExpanded(true);
    if (!matches.length) return;
    setActiveIndex(current => {
      if (event.key === 'ArrowDown') return current >= matches.length - 1 ? 0 : current + 1;
      return current <= 0 ? matches.length - 1 : current - 1;
    });
  }

  function clearDraft() {
    setValue('');
    setActiveIndex(-1);
    setExpanded(true);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.shell} ref={rootRef}>
      <form className={styles.searchBar} action="/products#all-products" method="get" role="search" onSubmit={handleSubmit}>
        <Search size={21} strokeWidth={1.7} aria-hidden="true" />
        <label className="sr-only" htmlFor="catalogue-search">Search the catalogue</label>
        <input
          id="catalogue-search"
          ref={inputRef}
          name="q"
          value={value}
          onChange={event => { setValue(event.target.value); setActiveIndex(-1); setExpanded(true); }}
          onFocus={openSuggestions}
          onKeyDown={handleKeyDown}
          placeholder="Product, company or barcode"
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listboxId}
          aria-activedescendant={showSuggestions && currentActiveIndex >= 0 ? `${listboxId}-${currentActiveIndex}` : undefined}
        />
        {value ? <button className={styles.clear} type="button" onClick={clearDraft} aria-label="Clear search"><X size={16} aria-hidden="true" /></button> : null}
        <input type="hidden" name="market" value={market} />
        <button className={styles.submit} type="submit" aria-label="Search">Search</button>
        <div className={styles.market} aria-label="Shopping market">
          <Link aria-current={market === 'NG' ? 'true' : undefined} className={market === 'NG' ? styles.active : ''} href={marketHrefs.NG}>Nigeria</Link>
          <Link aria-current={market === 'US' ? 'true' : undefined} className={market === 'US' ? styles.active : ''} href={marketHrefs.US}>US</Link>
        </div>
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {expanded ? `${matches.length} ${matches.length === 1 ? 'suggestion' : 'suggestions'}.` : ''}
      </p>
      {showSuggestions ? <section className={styles.suggestions} aria-label="Search suggestions">
        <div className={styles.suggestionHeading}>
          <span>{value.trim() ? 'Suggestions' : 'Start here'}</span>
          <button type="button" onClick={closeSuggestions} aria-label="Close suggestions"><X size={17} aria-hidden="true" /></button>
        </div>
        <div className={styles.suggestionList} id={listboxId} role="listbox">
          {matches.map((suggestion, index) => <Link
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={currentActiveIndex === index}
            tabIndex={-1}
            href={suggestion.href}
            onPointerMove={() => setActiveIndex(index)}
            onClick={closeSuggestions}
            key={`${suggestion.kind}-${suggestion.href}`}
          >
            <span><small>{kindLabels[suggestion.kind]}</small><strong>{suggestion.label}</strong><em>{suggestion.detail}</em></span>
            <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
          </Link>)}
        </div>
      </section> : null}
    </div>
  );
}
