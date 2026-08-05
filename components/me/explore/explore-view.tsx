'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import { ProductCard, type ProductCardContext } from '@/components/products/product-card';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import {
  clearCustomerExploreFilters,
  countCustomerExploreFilters,
  type CustomerExploreFilterOptions,
  type CustomerExploreFilterState,
  type CustomerExploreProjection,
  flattenCustomerExplore,
} from '@/lib/customer/explore-model';
import styles from '../home/me-home.module.css';

type ProductSource = 'home' | 'explore' | 'shelf' | 'routine';
function memberProductHref(product: { slug: string }, source?: ProductSource) {
  const pathname = `/me/product/${product.slug}`;
  return source ? `${pathname}?from=${source}` : pathname;
}

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

function ExploreFilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ExploreFilterSheet({
  open,
  triggerRef,
  filters,
  options,
  visibleCount,
  totalCount,
  onChange,
  onClose,
}: {
  open: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  filters: CustomerExploreFilterState;
  options: CustomerExploreFilterOptions;
  visibleCount: number;
  totalCount: number;
  onChange: (filters: CustomerExploreFilterState) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeCount = countCustomerExploreFilters(filters);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  const update = <Key extends keyof CustomerExploreFilterState>(
    key: Key,
    value: CustomerExploreFilterState[Key],
  ) => onChange({ ...filters, [key]: value });

  return (
    <dialog
      id="me-explore-filter-sheet"
      ref={dialogRef}
      className={styles.filterDialog}
      aria-labelledby="me-explore-filter-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className={styles.filterSheet}>
        <header className={styles.filterSheetHeader}>
          <div>
            <p className={styles.eyebrow}>Your catalogue</p>
            <h2 id="me-explore-filter-title">Smart filters</h2>
            <p>{visibleCount} of {totalCount} exact products</p>
          </div>
          <button type="button" aria-label="Close filters" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.filterGrid}>
          <ExploreFilterSelect
            label="Category"
            value={filters.category}
            allLabel="All categories"
            options={options.categories.map(value => ({ value, label: value }))}
            onChange={(value) => update('category', value)}
          />
          <ExploreFilterSelect
            label="Routine step"
            value={filters.step}
            allLabel="All steps"
            options={options.steps.map(value => ({ value, label: value }))}
            onChange={(value) => update('step', value)}
          />
          <ExploreFilterSelect
            label="Brand"
            value={filters.brand}
            allLabel="All brands"
            options={options.brands.map(value => ({ value, label: value }))}
            onChange={(value) => update('brand', value)}
          />
          <label className={styles.filterField}>
            <span>Shelf</span>
            <select
              value={filters.shelf}
              onChange={(event) => update(
                'shelf',
                event.target.value as CustomerExploreFilterState['shelf'],
              )}
            >
              <option value="all">Any Shelf state</option>
              <option value="on">On your Shelf</option>
              <option value="off">Not on your Shelf</option>
            </select>
          </label>
          {options.concerns.length ? (
            <ExploreFilterSelect
              label="My concern"
              value={filters.concernSlug}
              allLabel="All concern support"
              options={options.concerns.map(concern => ({ value: concern.slug, label: concern.name }))}
              onChange={(value) => update('concernSlug', value)}
            />
          ) : null}
          {options.retailers.length ? (
            <ExploreFilterSelect
              label="My store"
              value={filters.retailerName}
              allLabel="All fresh exact stores"
              options={options.retailers.map(value => ({ value, label: value }))}
              onChange={(value) => update('retailerName', value)}
            />
          ) : null}
        </div>

        <footer className={styles.filterSheetActions}>
          <button
            type="button"
            disabled={!activeCount}
            onClick={() => onChange(clearCustomerExploreFilters())}
          >
            Clear filters{activeCount ? ` · ${activeCount}` : ''}
          </button>
          <button type="button" onClick={close}>Show {visibleCount} products</button>
        </footer>
      </div>
    </dialog>
  );
}

export function ExploreView({
  viewModel,
  projection,
  filters,
  filterOptions,
  onFiltersChange,
  searchRef,
  shelfAction,
}: {
  viewModel: CustomerPortalViewModel;
  projection: CustomerExploreProjection;
  filters: CustomerExploreFilterState;
  filterOptions: CustomerExploreFilterOptions;
  onFiltersChange: (filters: CustomerExploreFilterState) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shelfAction?: ShelfActionHandler;
}) {
  const surface = ME_PORTAL_SURFACES.explore;
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const visibleProducts = flattenCustomerExplore(projection);
  const activeCount = countCustomerExploreFilters(filters);
  return (
    <section className={styles.routePage} aria-labelledby="me-explore-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-explore-title">{surface.title}</h1>
        <p>Every exact product, arranged around the care context you chose.</p>
      </div>
      <SearchField
        value={filters.search}
        onChange={(search) => onFiltersChange({ ...filters, search })}
        inputRef={searchRef}
        label="Search exact products"
      />
      <div className={styles.exploreToolbar}>
        <p role="status" aria-live="polite">
          <strong>{visibleProducts.length}</strong> of {projection.eligibleCount} products
        </p>
        <button
          ref={filterTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-controls="me-explore-filter-sheet"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filters{activeCount ? ` · ${activeCount}` : ''}
        </button>
      </div>

      {visibleProducts.length ? (
        <div className={styles.exploreSections}>
          {projection.sections.map((section) => {
            const headingId = `me-explore-${section.id.replace(':', '-')}`;
            return (
              <section key={section.id} className={styles.exploreSection} aria-labelledby={headingId}>
                <header className={styles.exploreSectionHeading}>
                  <h2 id={headingId}>{section.title}</h2>
                  <p>{section.description}</p>
                </header>
                <div className="product-grid">
                  {section.products.map((entry) => {
                    const shelfItem = viewModel.shelf.find(item => item.product?.slug === entry.product.slug);
                    const cardContext: ProductCardContext = {
                      onShelf: entry.onShelf,
                      inRoutine: entry.inRoutine,
                      reviewedConcern: entry.matchedConcernSlugs.length > 0,
                      retailerNames: entry.matchedRetailerNames,
                    };
                    return (
                      <ProductCard
                        key={entry.product.slug}
                        product={entry.product}
                        href={memberProductHref(entry.product, 'explore')}
                        context={cardContext}
                        footer={viewModel.shelfState.status === 'ready' ? (
                          <ShelfActionButton
                            productSlug={entry.product.slug}
                            saved={Boolean(shelfItem)}
                            placement="explore"
                            onAction={shelfAction}
                          />
                        ) : null}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyAction}>
          <Search size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>No exact products match these filters.</p>
          <button
            className={styles.retryAction}
            type="button"
            onClick={() => onFiltersChange(clearCustomerExploreFilters())}
          >
            Clear filters
          </button>
        </div>
      )}

      <ExploreFilterSheet
        open={filterOpen}
        triggerRef={filterTriggerRef}
        filters={filters}
        options={filterOptions}
        visibleCount={visibleProducts.length}
        totalCount={projection.eligibleCount}
        onChange={onFiltersChange}
        onClose={() => setFilterOpen(false)}
      />
    </section>
  );
}
