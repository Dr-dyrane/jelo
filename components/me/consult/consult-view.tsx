'use client';

import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { ProductCard } from '@/components/products/product-card';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import type {
  CustomerPortalProduct,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import { concerns as knowledgeConcerns } from '@/data/knowledge';
import { matchConcerns } from '@/lib/customer/concern-matching';
import { ConcernContent } from './concern-content';
import styles from '../home/me-home.module.css';

function SearchField({
  value,
  onChange,
  inputRef,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
}) {
  return (
    <label className={styles.searchField}>
      <Search size={19} aria-hidden="true" />
      <span className={styles.visuallyHidden}>{label}</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
      />
    </label>
  );
}

function memberProductHref(product: { slug: string }, source?: string) {
  const pathname = `/me/product/${product.slug}`;
  return source ? `${pathname}?from=${source}` : pathname;
}

export function ConsultView({
  viewModel,
  products,
  search,
  setSearch,
  searchRef,
}: {
  viewModel: CustomerPortalViewModel;
  products: readonly CustomerPortalProduct[];
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const surface = ME_PORTAL_SURFACES.consult;
  const concernMatches = useMemo(
    () => (search.trim() ? matchConcerns(search, knowledgeConcerns) : []),
    [search],
  );
  const savedSlugs = useMemo(
    () => new Set(viewModel.concerns.map((concern) => concern.slug)),
    [viewModel.concerns],
  );

  return (
    <section className={`${styles.routePage} ${styles.stackPage}`} aria-labelledby="me-consult-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-consult-title">{surface.title}</h1>
      </div>
      <section className={styles.concernsLanding} aria-labelledby="me-concerns-title">
        <header>
          <div>
            <p className={styles.eyebrow}>My concerns</p>
            <h2 id="me-concerns-title">What I’ve noticed.</h2>
          </div>
          <span>{viewModel.concerns.length}</span>
        </header>
        {viewModel.concerns.length ? (
          <>
            <div className={styles.concernList} aria-label="My concerns">
              {viewModel.concerns.map((concern) => (
                <span key={concern.slug}>{concern.name}<small>{concern.area}</small></span>
              ))}
            </div>
            <p>
              {viewModel.account.synthetic
                ? 'Local preview only · These examples are not a diagnosis.'
                : 'Educational care context only · Not a diagnosis.'}
            </p>
          </>
        ) : (
          <p>
            No concerns have been reported here. Search what you notice below; this does not save or diagnose a concern.
          </p>
        )}
      </section>

      <div className={styles.askSearchHeading}>
        <p className={styles.eyebrow}>Ask Me</p>
        <h2>Explore your care.</h2>
        <p>Search the exact catalogue in your own words.</p>
      </div>
      <SearchField value={search} onChange={setSearch} inputRef={searchRef} label="Search my care" />
      {search.trim() ? (
        <>
          {concernMatches.length > 0 ? (
            <div className={styles.concernContentStack}>
              {concernMatches.map((match) => (
                <ConcernContent
                  key={match.concern.slug}
                  concern={match.concern}
                  matchedTerms={match.matchedTerms}
                  matchedSignals={match.matchedSignals}
                  saved={savedSlugs.has(match.concern.slug)}
                  onSave={() => {
                    /* persistence comes in Slice 4 */
                  }}
                />
              ))}
            </div>
          ) : null}
          <div id="me-consult-products">
            {products.length ? (
              <div className="product-grid">
                {products.slice(0, 6).map((product) => (
                  <ProductCard key={product.slug} product={product} href={memberProductHref(product, 'home')} />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>No exact catalogue products match that search.</p>
            )}
          </div>
        </>
      ) : (
        <p className={styles.consultBoundary}>Suggestions and saved concern reporting are not available yet.</p>
      )}
    </section>
  );
}
