"use client";

import Link from "next/link";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import { ShelfActionButton } from "@/components/me/shelf/shelf-action-button";
import {
  ProductCard,
  type ProductCardContext,
} from "@/components/products/product-card";
import { useControlledDialog } from "@/components/ui/use-controlled-dialog";
import { ME_PORTAL_SURFACES } from "@/components/me/shell/me-shell-model";
import type { CustomerPortalViewModel } from "@/lib/customer/portal-model";
import type { ShelfActionHandler } from "@/components/me/shelf/me-shelf-state";
import {
  clearCustomerExploreFilters,
  countCustomerExploreFilters,
  type CustomerExploreFilterOptions,
  type CustomerExploreFilterState,
  type CustomerExploreProjection,
  flattenCustomerExplore,
} from "@/lib/customer/explore-model";
import styles from "../home/me-home.module.css";
import routeStyles from "./explore-view.module.css";

type ProductSource = "home" | "explore" | "shelf" | "routine";
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

function ExploreFilterGroup({
  label,
  value,
  allValue = "",
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allValue?: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={routeStyles.filterGroup}
      role="group"
      aria-label={`${label} filter`}
    >
      <span className={routeStyles.filterLabel}>{label}</span>
      <div className={routeStyles.filterChoices}>
        <button
          type="button"
          className={
            value === allValue
              ? routeStyles.filterChoiceActive
              : routeStyles.filterChoice
          }
          aria-pressed={value === allValue}
          onClick={() => onChange(allValue)}
        >
          {value === allValue ? <Check size={13} aria-hidden="true" /> : null}
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              value === option.value
                ? routeStyles.filterChoiceActive
                : routeStyles.filterChoice
            }
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {value === option.value ? (
              <Check size={13} aria-hidden="true" />
            ) : null}
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
  const { dialogRef, handleCancel, handleBackdropClick } = useControlledDialog({
    open,
    onClose,
    restoreFocusRef: triggerRef,
  });
  const activeCount = countCustomerExploreFilters(filters);

  const close = () => {
    onClose();
    window.requestAnimationFrame(() =>
      triggerRef.current?.focus({ preventScroll: true }),
    );
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
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className={`${styles.filterSheet} ${routeStyles.filterSheet}`}>
        <header className={styles.filterSheetHeader}>
          <div>
            <p className={styles.eyebrow}>Your catalogue</p>
            <h2 id="me-explore-filter-title">Smart filters</h2>
            <p>
              {visibleCount} of {totalCount} exact products
            </p>
          </div>
          <button type="button" aria-label="Close filters" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={routeStyles.filterGroups}>
          <ExploreFilterGroup
            label="Category"
            value={filters.category}
            allLabel="All categories"
            options={options.categories.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) => update("category", value)}
          />
          <ExploreFilterGroup
            label="Routine step"
            value={filters.step}
            allLabel="All steps"
            options={options.steps.map((value) => ({ value, label: value }))}
            onChange={(value) => update("step", value)}
          />
          <ExploreFilterGroup
            label="Brand"
            value={filters.brand}
            allLabel="All brands"
            options={options.brands.map((value) => ({ value, label: value }))}
            onChange={(value) => update("brand", value)}
          />
          <ExploreFilterGroup
            label="Shelf"
            value={filters.shelf}
            allValue="all"
            allLabel="Any Shelf state"
            options={[
              { value: "on", label: "On your Shelf" },
              { value: "off", label: "Not on your Shelf" },
            ]}
            onChange={(value) =>
              update("shelf", value as CustomerExploreFilterState["shelf"])
            }
          />
          <ExploreFilterGroup
            label="Routine"
            value={filters.routine}
            allValue="all"
            allLabel="Any routine state"
            options={[
              { value: "in", label: "In your routine" },
              { value: "out", label: "Not in your routine" },
            ]}
            onChange={(value) =>
              update("routine", value as CustomerExploreFilterState["routine"])
            }
          />
          {options.concerns.length ? (
            <ExploreFilterGroup
              label="My concern"
              value={filters.concernSlug}
              allLabel="All concern support"
              options={options.concerns.map((concern) => ({
                value: concern.slug,
                label: concern.name,
              }))}
              onChange={(value) => update("concernSlug", value)}
            />
          ) : null}
          {options.retailers.length ? (
            <ExploreFilterGroup
              label="My store"
              value={filters.retailerName}
              allLabel="All fresh exact stores"
              options={options.retailers.map((value) => ({
                value,
                label: value,
              }))}
              onChange={(value) => update("retailerName", value)}
            />
          ) : null}
        </div>

        <footer className={styles.filterSheetActions}>
          <button
            type="button"
            disabled={!activeCount}
            onClick={() => onChange(clearCustomerExploreFilters())}
          >
            Clear filters{activeCount ? ` · ${activeCount}` : ""}
          </button>
          <button type="button" onClick={close}>
            Show {visibleCount} products
          </button>
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
  const activeFilters = [
    filters.search
      ? { key: "search" as const, label: `Search: ${filters.search}` }
      : null,
    filters.category
      ? { key: "category" as const, label: filters.category }
      : null,
    filters.step ? { key: "step" as const, label: filters.step } : null,
    filters.brand ? { key: "brand" as const, label: filters.brand } : null,
    filters.shelf !== "all"
      ? {
          key: "shelf" as const,
          label: filters.shelf === "on" ? "On your Shelf" : "Not on your Shelf",
        }
      : null,
    filters.routine !== "all"
      ? {
          key: "routine" as const,
          label:
            filters.routine === "in"
              ? "In your routine"
              : "Not in your routine",
        }
      : null,
    filters.concernSlug
      ? {
          key: "concernSlug" as const,
          label:
            filterOptions.concerns.find(
              (concern) => concern.slug === filters.concernSlug,
            )?.name ?? filters.concernSlug,
        }
      : null,
    filters.retailerName
      ? { key: "retailerName" as const, label: filters.retailerName }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));

  const clearFilter = (key: (typeof activeFilters)[number]["key"]) => {
    if (key === "shelf") onFiltersChange({ ...filters, shelf: "all" });
    else if (key === "routine") onFiltersChange({ ...filters, routine: "all" });
    else onFiltersChange({ ...filters, [key]: "" });
  };

  return (
    <section
      className={`${styles.routePage} ${styles.explorePage} ${routeStyles.page}`}
      aria-labelledby="me-explore-title"
    >
      <div className={styles.exploreDiscovery}>
        <div className={`${styles.routeHeading} ${styles.exploreHeading}`}>
          <p className={styles.eyebrow}>{surface.eyebrow}</p>
          <h1 id="me-explore-title">{surface.title}</h1>
        </div>
        <div className={styles.exploreSearchRow}>
          <SearchField
            value={filters.search}
            onChange={(search) => onFiltersChange({ ...filters, search })}
            inputRef={searchRef}
            label="Search exact products"
          />
          <button
            ref={filterTriggerRef}
            type="button"
            className={styles.exploreFilterTrigger}
            aria-label={`Open filters${activeCount ? `, ${activeCount} active` : ""}`}
            aria-haspopup="dialog"
            aria-controls="me-explore-filter-sheet"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {activeCount ? (
              <span className={styles.exploreFilterBadge} aria-hidden="true">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
        <div
          className={styles.exploreCategoryRail}
          aria-label="Product categories"
        >
          <button
            type="button"
            aria-pressed={!filters.category}
            onClick={() => onFiltersChange({ ...filters, category: "" })}
          >
            All
          </button>
          {filterOptions.categories.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={filters.category === category}
              onClick={() => onFiltersChange({ ...filters, category })}
            >
              {category}
            </button>
          ))}
        </div>
        {activeFilters.length ? (
          <div
            className={styles.exploreActiveFilters}
            aria-label="Active filters"
          >
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => clearFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <X size={13} aria-hidden="true" />
                <span className={styles.visuallyHidden}>
                  Remove {filter.label} filter
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onFiltersChange(clearCustomerExploreFilters())}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>
      <div className={styles.exploreToolbar}>
        <p role="status" aria-live="polite">
          <strong>{visibleProducts.length}</strong> of{" "}
          {projection.eligibleCount} products
        </p>
      </div>

      {visibleProducts.length ? (
        <div className={styles.exploreSections}>
          {projection.sections.map((section) => {
            const headingId = `me-explore-${section.id.replace(":", "-")}`;
            return (
              <section
                key={section.id}
                className={styles.exploreSection}
                aria-labelledby={headingId}
              >
                <header className={styles.exploreSectionHeading}>
                  <h2 id={headingId}>{section.title}</h2>
                  <p>{section.description}</p>
                </header>
                <div className={`product-grid ${routeStyles.productGrid}`}>
                  {section.products.map((entry) => {
                    const shelfItem = viewModel.shelf.find(
                      (item) => item.product?.slug === entry.product.slug,
                    );
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
                        href={memberProductHref(entry.product, "explore")}
                        context={cardContext}
                        footer={
                          viewModel.shelfState.status === "ready" ? (
                            <ShelfActionButton
                              productSlug={entry.product.slug}
                              saved={Boolean(shelfItem)}
                              placement="explore"
                              onAction={shelfAction}
                            />
                          ) : null
                        }
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
          <Link href="/me/shelf/add">Request a missing product</Link>
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
