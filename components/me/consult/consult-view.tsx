'use client';

import { Search } from 'lucide-react';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ProductCard } from '@/components/products/product-card';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import type {
  CustomerPortalConcernReference,
  CustomerPortalProduct,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import { concerns as knowledgeConcerns } from '@/data/knowledge';
import { matchConcerns } from '@/lib/customer/concern-matching';
import { addConcernAction, removeConcernAction } from '@/app/(customer)/me/actions';
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
  previewOnly,
  addPreviewConcern,
  removePreviewConcern,
}: {
  viewModel: CustomerPortalViewModel;
  products: readonly CustomerPortalProduct[];
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  previewOnly?: boolean;
  addPreviewConcern?: (slug: string, name: string, area: CustomerPortalConcernReference['area']) => unknown;
  removePreviewConcern?: (slug: string) => unknown;
}) {
  const surface = ME_PORTAL_SURFACES.consult;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const concernMatches = useMemo(
    () => (search.trim() ? matchConcerns(search, knowledgeConcerns) : []),
    [search],
  );
  const savedSlugs = useMemo(
    () => new Set(viewModel.concerns.map((concern) => concern.slug)),
    [viewModel.concerns],
  );
  const isSearching = Boolean(search.trim());
  const primaryMatch = concernMatches[0] ?? null;
  const secondaryMatches = concernMatches.slice(1);

  const handleToggle = useCallback(
    (concern: { slug: string; name: string; area: CustomerPortalConcernReference['area']; kind: string }) => {
      if (concern.kind === 'condition-pattern') return;
      const isSaved = savedSlugs.has(concern.slug);
      if (previewOnly) {
        if (isSaved) {
          removePreviewConcern?.(concern.slug);
        } else {
          addPreviewConcern?.(concern.slug, concern.name, concern.area);
        }
        return;
      }
      setPendingSlug(concern.slug);
      startTransition(async () => {
        if (isSaved) {
          await removeConcernAction(concern.slug);
        } else {
          await addConcernAction(concern.slug);
        }
        setPendingSlug(null);
        router.refresh();
      });
    },
    [previewOnly, savedSlugs, addPreviewConcern, removePreviewConcern, router],
  );

  return (
    <section className={`${styles.routePage} ${styles.stackPage}`} aria-labelledby="me-consult-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-consult-title">{surface.title}</h1>
      </div>
      {!isSearching ? (
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
              No concerns saved yet. Search what you notice below to read reviewed guidance.
            </p>
          )}
        </section>
      ) : null}

      <div className={styles.askSearchHeading}>
        <h2>Search what you notice.</h2>
        <p>Reviewed guidance and matching products from the catalogue.</p>
      </div>
      <SearchField value={search} onChange={setSearch} inputRef={searchRef} label="Search my care" />
      {isSearching ? (
        <>
          {primaryMatch ? (
            <div className={styles.concernContentStack}>
              <ConcernContent
                concern={primaryMatch.concern}
                matchedTerms={primaryMatch.matchedTerms}
                matchedSignals={primaryMatch.matchedSignals}
                saved={savedSlugs.has(primaryMatch.concern.slug)}
                onToggle={() => handleToggle(primaryMatch.concern)}
              />
              {secondaryMatches.length > 0 ? (
                <div className={styles.concernContentRelated} aria-label="Related concerns">
                  <p className={styles.concernContentRelatedLabel}>Related concerns</p>
                  <ul>
                    {secondaryMatches.map((match) => (
                      <li key={match.concern.slug}>
                        <ConcernContent
                          concern={match.concern}
                          matchedTerms={match.matchedTerms}
                          matchedSignals={match.matchedSignals}
                          saved={savedSlugs.has(match.concern.slug)}
                          onToggle={() => handleToggle(match.concern)}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
        <p className={styles.consultBoundary}>
          Search a concern like “acne”, “dark spots” or “sensitive skin” to read reviewed guidance and find matching products.
        </p>
      )}
    </section>
  );
}
