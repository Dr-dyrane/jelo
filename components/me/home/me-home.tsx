'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ClockAlert,
  ClockPlus,
  Compass,
  Info,
  MessageCircleQuestion,
  PackagePlus,
  Search,
  ShelvingUnit,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import { RoutineManager } from '@/components/me/routine/routine-manager';
import {
  PrivateProductRequestShelf,
  ProductRequestAddPage,
  ProductRequestDetailPage,
} from '@/components/me/product-requests/product-request-experience';
import {
  useMeShelfState,
  type ShelfActionHandler,
} from '@/components/me/shelf/me-shelf-state';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { ProductCard, type ProductCardContext } from '@/components/products/product-card';
import { ProductQuickPanelSheet } from '@/components/products/product-quick-panel';
import {
  WorkspaceDockProvider,
  useAdaptiveWorkspaceDockController,
  useWorkspaceDockFabRegistration,
} from '@/components/workspace-shell';
import { MeAccountSheet } from '@/components/me/shell/me-account-sheet';
import { createMeContextSheetModel } from '@/components/me/shell/me-context-model';
import { MeContextSheet } from '@/components/me/shell/me-context-sheet';
import {
  createMeStackBack,
  createMeDockContext,
  ME_PORTAL_SURFACES,
  ME_WORKSPACE_FABS,
  resolveMeActiveParentHref,
  resolveMeHeaderHidden,
  type MePortalRoute,
  type MeProductOrigin,
  type MeWorkspacePage,
} from '@/components/me/shell/me-shell-model';
import { MeAccountAvatarIcon, MeWorkspaceDock } from '@/components/me/shell/me-workspace-dock';
import type {
  CustomerPortalProduct,
  CustomerPortalShelfItem,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import {
  clearCustomerExploreFilters,
  countCustomerExploreFilters,
  createCustomerExploreFilterOptions,
  createCustomerExploreProjection,
  filterCustomerExplore,
  flattenCustomerExplore,
  type CustomerExploreFilterOptions,
  type CustomerExploreFilterState,
  type CustomerExploreProjection,
} from '@/lib/customer/explore-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import type { CustomerProductRequestPresentationViewModel } from '@/lib/customer/product-request-model';
import type { ProductPanelData, ProductPanelTab } from '@/lib/catalogue/product-panel-model';
import styles from './me-home.module.css';

type ProductSource = MeProductOrigin;
const EMPTY_PRODUCTS: readonly CustomerPortalProduct[] = [];

function memberProductHref(product: CustomerPortalProduct, source?: ProductSource) {
  const pathname = `/me/product/${product.slug}`;
  return source ? `${pathname}?from=${source}` : pathname;
}

function UnavailableShelfCard({
  item,
  shelfAction,
  onSettled,
}: {
  item: CustomerPortalShelfItem;
  shelfAction?: ShelfActionHandler;
  onSettled: (result: CustomerShelfActionResult) => void;
}) {
  return (
    <article className={`${styles.productCardShell} ${styles.unavailableProduct}`}>
      <div className={styles.unavailableCopy}>
        <small>{item.snapshot.brand}</small>
        <strong>{item.snapshot.name}</strong>
        <span>{item.snapshot.size} · {item.availability === 'changed' ? 'Changed' : 'Unavailable'}</span>
        {item.message ? <p>{item.message}</p> : null}
      </div>
      <ShelfActionButton
        shelfItem={item}
        placement="card"
        onAction={shelfAction}
        onSettled={onSettled}
      />
    </article>
  );
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

function routeState(route: MePortalRoute, viewModel: CustomerPortalViewModel) {
  const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;
  if (route.kind === 'home') {
    return { routeKey: '/me', currentHref: resolveMeActiveParentHref(route), page: 'home' as MeWorkspacePage, detail: 'My care' };
  }
  if (route.kind === 'explore') {
    return { routeKey: '/me/explore', currentHref: resolveMeActiveParentHref(route), page: 'explore' as MeWorkspacePage, detail: 'Exact catalogue' };
  }
  if (route.kind === 'shelf') {
    return {
      routeKey: '/me/shelf',
      currentHref: resolveMeActiveParentHref(route),
      page: 'shelf' as MeWorkspacePage,
      detail: viewModel.shelfState.status === 'ready'
        ? count(viewModel.shelf.length, 'saved product')
        : 'Shelf unavailable',
    };
  }
  if (route.kind === 'routine') {
    const stepCount = viewModel.routines?.reduce((total, routine) => total + routine.steps.length, 0)
      ?? viewModel.routine.length;
    return { routeKey: '/me/routine', currentHref: resolveMeActiveParentHref(route), page: 'routine' as MeWorkspacePage, detail: count(stepCount, 'saved step') };
  }
  if (route.kind === 'consult') {
    return { routeKey: '/me/consult', currentHref: resolveMeActiveParentHref(route), page: 'consult' as MeWorkspacePage, detail: 'My care' };
  }
  if (route.kind === 'shelf-add') {
    return { routeKey: '/me/shelf/add', currentHref: resolveMeActiveParentHref(route), page: 'shelf-add' as MeWorkspacePage, detail: 'Exact catalogue first' };
  }
  if (route.kind === 'shelf-request') {
    return {
      routeKey: `/me/shelf/request/${route.id}`,
      currentHref: resolveMeActiveParentHref(route),
      page: 'shelf-request' as MeWorkspacePage,
      detail: 'Private product request',
    };
  }
  if (route.kind === 'not-found') {
    return { routeKey: '/me/product/not-found', currentHref: resolveMeActiveParentHref(route), page: 'not-found' as MeWorkspacePage, detail: 'Product not found' };
  }
  return {
    routeKey: `/me/product/${route.slug}`,
    currentHref: resolveMeActiveParentHref(route),
    page: 'product' as MeWorkspacePage,
    detail: 'Details',
  };
}

function HomePage({
  viewModel,
  shelfAction,
  onShelfMutation,
}: {
  viewModel: CustomerPortalViewModel;
  shelfAction?: ShelfActionHandler;
  onShelfMutation: (result: CustomerShelfActionResult) => void;
}) {
  const surface = ME_PORTAL_SURFACES.home;
  return (
    <>
      <section className={styles.hero} aria-labelledby="me-home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{viewModel.account.preferredFirstName ?? surface.eyebrow}</p>
          <h1 id="me-home-title">{surface.title}</h1>
          <Link className={styles.primaryAction} href="/me/consult">
            Ask Me <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        {viewModel.featuredProduct ? (
          <Link
            className={styles.heroProduct}
            href={memberProductHref(viewModel.featuredProduct, 'home')}
            aria-label={`Explore ${viewModel.featuredProduct.brand} ${viewModel.featuredProduct.name}`}
          >
            <span className={styles.heroHalo} aria-hidden="true" />
            <SafeProductImage
              src={viewModel.featuredProduct.image}
              alt={`${viewModel.featuredProduct.brand} ${viewModel.featuredProduct.name}`}
              priority
            />
            <span className={styles.heroProductLabel}>
              <small>{viewModel.featuredProduct.brand}</small>
              <strong>{viewModel.featuredProduct.name}</strong>
            </span>
          </Link>
        ) : (
          <div className={styles.heroQuiet} aria-hidden="true"><Sparkles size={42} /></div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="me-shelf-preview-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Saved products</p>
          <h2 id="me-shelf-preview-title">My Shelf.</h2>
          <Link className={styles.sectionLink} href={'/me/shelf'}>Open Shelf <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {viewModel.shelf.length ? (
          <div className="product-grid">
            {viewModel.shelf.slice(0, 3).map((item) => item.product ? (
              <ProductCard
                key={item.identityVersionId}
                product={item.product}
                href={memberProductHref(item.product, 'shelf')}
              />
            ) : (
              <UnavailableShelfCard
                key={item.identityVersionId}
                item={item}
                shelfAction={shelfAction}
                onSettled={onShelfMutation}
              />
            ))}
          </div>
        ) : viewModel.shelfState.status === 'unavailable' ? (
          <div className={styles.emptyAction} role="status">
            <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
            <p>{viewModel.shelfState.message}</p>
            <Link href="/me">Try again</Link>
          </div>
        ) : (
          <div className={styles.emptyAction}>
            <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
            <p>Nothing saved yet.</p>
            <Link href="/me/explore">Explore products</Link>
          </div>
        )}
      </section>

      <section className={`${styles.section} ${styles.routineSurface}`} aria-labelledby="me-routine-preview-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{viewModel.routineProvenance ?? 'My Routine'}</p>
          <h2 id="me-routine-preview-title">My steps.</h2>
          <Link className={styles.sectionLink} href={'/me/routine'}>Open Routine <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <RoutineList viewModel={viewModel} />
      </section>
    </>
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

function ExplorePage({
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

function ShelfPage({
  viewModel,
  productRequestOutcome,
  productRequestPresentation,
  shelfAction,
  onShelfMutation,
}: {
  viewModel: CustomerPortalViewModel;
  productRequestOutcome?: string;
  productRequestPresentation?: CustomerProductRequestPresentationViewModel;
  shelfAction?: ShelfActionHandler;
  onShelfMutation: (result: CustomerShelfActionResult) => void;
}) {
  const surface = ME_PORTAL_SURFACES.shelf;
  return (
    <section className={styles.routePage} aria-labelledby="me-shelf-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-shelf-title">{surface.title}</h1>
      </div>
      {viewModel.shelfState.status === 'unavailable' ? (
        <div className={styles.emptyAction} role="status">
          <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>{viewModel.shelfState.message}</p>
          <Link href="/me/shelf">Try again</Link>
        </div>
      ) : viewModel.shelf.length ? (
        <div className="product-grid">
          {viewModel.shelf.map((item) => item.product ? (
            <ProductCard
              key={item.identityVersionId}
              product={item.product}
              href={memberProductHref(item.product, 'shelf')}
            />
          ) : (
            <UnavailableShelfCard
              key={item.identityVersionId}
              item={item}
              shelfAction={shelfAction}
              onSettled={onShelfMutation}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyAction}>
          <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>Nothing saved yet.</p>
          <Link href="/me/explore">Explore products</Link>
        </div>
      )}
      {viewModel.shelfState.status === 'ready' ? (
        <PrivateProductRequestShelf
          synthetic={viewModel.account.synthetic}
          initialRequests={productRequestPresentation?.requests}
          mutationOutcome={productRequestOutcome}
        />
      ) : null}
    </section>
  );
}

function RoutineList({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  if (!viewModel.routine.length) {
    return (
      <div className={styles.emptyAction}>
        <ClockPlus size={24} strokeWidth={1.5} aria-hidden="true" />
        <p>No routine yet.</p>
        <Link href="/me/explore">Add routine step</Link>
      </div>
    );
  }
  return (
    <ol className={styles.routineList}>
      {viewModel.routine.map((step, index) => {
        const StatusIcon = step.status === 'alert' ? ClockAlert : ClockPlus;
        const statusLabel = step.status === 'alert'
          ? 'Routine alert'
          : step.status === 'done'
            ? 'Routine done'
            : 'Routine step confirmed';
        return (
          <li key={step.id}>
            <Link href={memberProductHref(step.product, 'routine')} aria-label={`View ${step.product.name}`}>
              <span className={styles.routineImage}>
                <SafeProductImage src={step.product.image} alt={`${step.product.brand} ${step.product.name}`} />
              </span>
              <span className={styles.routineNumber}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <StatusIcon size={17} aria-hidden="true" />
                <span className={styles.visuallyHidden}>{statusLabel}</span>
              </span>
              <span className={styles.routineCopy}>
                <small>{step.moment}</small>
                <strong>{step.product.brand} {step.product.name}</strong>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function RoutinePage({
  viewModel,
  mutationOutcome,
}: {
  viewModel: CustomerPortalViewModel;
  mutationOutcome?: string;
}) {
  const surface = ME_PORTAL_SURFACES.routine;
  return (
    <section className={styles.routePage} aria-labelledby="me-routine-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{viewModel.routineProvenance ?? surface.eyebrow}</p>
        <h1 id="me-routine-title">{surface.title}</h1>
      </div>
      {viewModel.routines ? (
        <RoutineManager
          routines={viewModel.routines}
          routineState={viewModel.routineState ?? { status: 'ready', message: null }}
          outcome={mutationOutcome}
        />
      ) : <RoutineList viewModel={viewModel} />}
    </section>
  );
}

function ConsultPage({
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
        products.length ? (
          <div className="product-grid">
            {products.slice(0, 6).map((product) => (
              <ProductCard key={product.slug} product={product} href={memberProductHref(product, 'home')} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No exact catalogue products match that search.</p>
        )
      ) : (
        <p className={styles.consultBoundary}>Suggestions and saved concern reporting are not available yet.</p>
      )}
    </section>
  );
}

function ProductPage({
  product,
  viewModel,
  origin,
  shelfAction,
  onShelfMutation,
  panelOpen,
  panelTab,
  onOpenPanel,
}: {
  product: CustomerPortalProduct;
  viewModel: CustomerPortalViewModel;
  origin: MeProductOrigin;
  shelfAction?: ShelfActionHandler;
  onShelfMutation: (result: CustomerShelfActionResult) => void;
  panelOpen: boolean;
  panelTab: ProductPanelTab;
  onOpenPanel: (tab: ProductPanelTab, opener?: HTMLElement | null) => void;
}) {
  const shelfItem = viewModel.shelf.find((item) => item.product?.slug === product.slug);
  const routineStep = viewModel.routine.find((step) => step.product.slug === product.slug);
  const shelfAvailable = viewModel.shelfState.status === 'ready';
  const fromShelf = origin === 'shelf';
  const showShelfAction = shelfAvailable && (!fromShelf || Boolean(shelfItem));
  return (
    <article className={`${styles.routePage} ${styles.stackPage} ${styles.productPage}`} aria-labelledby="me-product-title">
      <div className={styles.productHero}>
        <div className={styles.productVisualLarge}>
          <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} priority />
        </div>
        <div className={styles.productStory}>
          <p className={styles.eyebrow}>{product.brand}</p>
          <h1 id="me-product-title">{product.name}</h1>
          <p>{product.displayLine}</p>
          {product.priceLabel ? <p className={styles.productPrice}>{product.priceLabel}</p> : null}
          <p className={styles.productUsage}>{product.usage}</p>
          <div className={styles.productActions}>
            <div className={styles.productEvidenceActions} role="group" aria-label="Product information">
              <button
                className={styles.productEvidenceAction}
                type="button"
                aria-haspopup="dialog"
                aria-controls="me-product-evidence-sheet"
                aria-expanded={panelOpen && panelTab === 'buy'}
                onClick={(event) => onOpenPanel('buy', event.currentTarget)}
              >
                <ShoppingBag size={16} aria-hidden="true" /> Find a store
              </button>
              <button
                className={`${styles.productEvidenceAction} ${styles.productEvidenceActionSecondary}`}
                type="button"
                aria-haspopup="dialog"
                aria-controls="me-product-evidence-sheet"
                aria-expanded={panelOpen && panelTab === 'details'}
                onClick={(event) => onOpenPanel('details', event.currentTarget)}
              >
                <Info size={16} aria-hidden="true" /> Details
              </button>
            </div>
            {showShelfAction ? (
              <ShelfActionButton
                productSlug={product.slug}
                shelfItem={fromShelf ? shelfItem : undefined}
                saved={!fromShelf && Boolean(shelfItem)}
                placement="product"
                onAction={shelfAction}
                onSettled={fromShelf ? onShelfMutation : undefined}
              />
            ) : null}
          </div>
          <div className={styles.productMeta} aria-label="My product context">
            <span>{product.size}</span>
            <span>{product.category}</span>
            <span>{product.step}</span>
            <span>
              {shelfAvailable ? (shelfItem ? 'On my Shelf' : 'Not on my Shelf') : 'Shelf unavailable'} · {routineStep ? 'In my Routine' : 'Not in my Routine'}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function MemberNotFoundPage() {
  const surface = ME_PORTAL_SURFACES['not-found'];
  return (
    <section className={`${styles.routePage} ${styles.stackPage} ${styles.notFoundPage}`} aria-labelledby="me-not-found-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-not-found-title">{surface.title}</h1>
        <p>This product is not in your exact catalogue.</p>
        <div className={styles.notFoundActions}>
          <Link className={styles.primaryAction} href="/me/explore">
            Explore products <Compass size={18} aria-hidden="true" />
          </Link>
          <Link className={styles.sectionLink} href="/me/shelf">Back to Shelf</Link>
        </div>
      </div>
    </section>
  );
}

function MePortalView({
  viewModel,
  route,
  productPanelData,
  productRequestOutcome,
  productRequestPresentation,
}: {
  viewModel: CustomerPortalViewModel;
  route: MePortalRoute;
  productPanelData?: ProductPanelData;
  productRequestOutcome?: string;
  productRequestPresentation?: CustomerProductRequestPresentationViewModel;
}) {
  const router = useRouter();
  const shelfState = useMeShelfState(viewModel);
  const portalViewModel = shelfState.viewModel;
  const [exploreFilters, setExploreFilters] = useState<CustomerExploreFilterState>(
    clearCustomerExploreFilters,
  );
  const [shelfMutationFeedback, setShelfMutationFeedback] = useState({ message: '', sequence: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  const shelfMutationStatusRef = useRef<HTMLParagraphElement>(null);
  const state = routeState(route, portalViewModel);
  const controller = useAdaptiveWorkspaceDockController({
    routeKey: state.routeKey,
    hasNavigation: true,
    hasContext: true,
  });
  const catalogue = portalViewModel.catalogue ?? EMPTY_PRODUCTS;
  const exploreProjection = useMemo(() => createCustomerExploreProjection({
    catalogue,
    shelf: portalViewModel.shelf,
    routine: portalViewModel.routine,
    concerns: portalViewModel.concerns,
    selectedRetailers: portalViewModel.selectedRetailers,
  }), [
    catalogue,
    portalViewModel.concerns,
    portalViewModel.routine,
    portalViewModel.selectedRetailers,
    portalViewModel.shelf,
  ]);
  const filteredExploreProjection = useMemo(() => (
    filterCustomerExplore(exploreProjection, exploreFilters)
  ), [exploreFilters, exploreProjection]);
  const exploreFilterOptions = useMemo(() => createCustomerExploreFilterOptions(
    exploreProjection,
    portalViewModel.concerns,
  ), [exploreProjection, portalViewModel.concerns]);
  const normalizedSearch = exploreFilters.search.trim().toLowerCase();
  const consultProducts = useMemo(() => catalogue.filter((product) => {
    if (!normalizedSearch) return true;
    return [product.brand, product.name, product.category, product.step, product.displayLine, product.size]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  }), [catalogue, normalizedSearch]);
  const visibleProductCount = route.kind === 'explore'
    ? flattenCustomerExplore(filteredExploreProjection).length
    : route.kind === 'consult' && normalizedSearch
      ? consultProducts.length
      : catalogue.length;
  const product = route.kind === 'product'
    ? catalogue.find((candidate) => candidate.slug === route.slug)
    : undefined;
  const context = createMeDockContext({ page: state.page, detail: state.detail });
  const back = createMeStackBack(route);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const [contextSheetState, setContextSheetState] = useState(() => ({
    routeKey: state.routeKey,
    open: false,
  }));
  const productPanelRestoreFocusRef = useRef<HTMLElement | null>(null);
  const [productPanelState, setProductPanelState] = useState(() => ({
    routeKey: state.routeKey,
    open: false,
    tab: 'buy' as ProductPanelTab,
  }));
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [accountSheetState, setAccountSheetState] = useState(() => ({
    routeKey: state.routeKey,
    open: false,
  }));
  const [headerOwnsFocus, setHeaderOwnsFocus] = useState(false);
  const contextSheetOpen = contextSheetState.routeKey === state.routeKey && contextSheetState.open;
  const productPanelOpen = route.kind === 'product'
    && Boolean(productPanelData)
    && productPanelState.routeKey === state.routeKey
    && productPanelState.open;
  const accountSheetOpen = accountSheetState.routeKey === state.routeKey && accountSheetState.open;
  const openProductPanel = (tab: ProductPanelTab, opener?: HTMLElement | null) => {
    if (route.kind !== 'product' || !productPanelData) return;
    const activeElement = document.activeElement;
    productPanelRestoreFocusRef.current = opener
      ?? (activeElement instanceof HTMLElement ? activeElement : null);
    setProductPanelState({ routeKey: state.routeKey, open: true, tab });
  };
  const closeProductPanel = () => {
    setProductPanelState((current) => current.routeKey === state.routeKey
      ? { ...current, open: false }
      : current);
  };
  const contextSheetModel = createMeContextSheetModel({
    route,
    viewModel: portalViewModel,
    visibleProductCount,
    product,
  });
  const dockContext = route.kind === 'product' ? {
    ...context,
    accessibleLabel: `Open details for ${product?.name ?? 'this product'}`,
    controls: 'me-product-evidence-sheet',
    expanded: productPanelOpen,
    onInvoke: () => openProductPanel('details'),
  } : {
    ...context,
    accessibleLabel: `Open ${context.label} summary. ${context.detail}`,
    controls: 'me-context-sheet',
    expanded: contextSheetOpen,
    onInvoke: () => setContextSheetState({ routeKey: state.routeKey, open: true }),
  };
  const headerHidden = resolveMeHeaderHidden({
    chromeHidden: controller.scroll.chromeHidden,
    accountSheetOpen: accountSheetOpen || contextSheetOpen || productPanelOpen,
    headerOwnsFocus,
  });
  useEffect(() => {
    if (!shelfMutationFeedback.message) return;
    const frame = window.requestAnimationFrame(() => {
      shelfMutationStatusRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route, shelfMutationFeedback.message, shelfMutationFeedback.sequence]);

  const announceShelfMutation = (result: CustomerShelfActionResult) => {
    if (result.status === 'removed' || result.status === 'already_removed') {
      setShelfMutationFeedback(current => ({
        message: result.message,
        sequence: current.sequence + 1,
      }));
    }
  };
  const focusSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchRef.current?.focus({ preventScroll: true });
  };
  const fabContract = ME_WORKSPACE_FABS[state.page];
  const fabIcon = state.page === 'home'
    ? MessageCircleQuestion
    : state.page === 'explore' || state.page === 'consult' || state.page === 'shelf-add'
      ? Search
      : state.page === 'routine'
        ? ClockPlus
        : state.page === 'shelf-request'
          ? PackagePlus
        : state.page === 'product'
          ? ShoppingBag
          : Compass;

  const invokeFab = () => {
    if (fabContract.action === 'focus-search') {
      focusSearch();
      return;
    }
    if (fabContract.action === 'open-product-prices') {
      openProductPanel('buy');
      return;
    }
    router.push(fabContract.href);
  };

  useWorkspaceDockFabRegistration({
    ownerId: fabContract.ownerId,
    routeKey: state.routeKey,
    label: fabContract.label,
    icon: fabIcon,
    onInvoke: invokeFab,
  });

  function closeAccountSheet() {
    setAccountSheetState((current) => current.routeKey === state.routeKey
      ? { ...current, open: false }
      : current);
  }

  function closeContextSheet() {
    setContextSheetState((current) => current.routeKey === state.routeKey
      ? { ...current, open: false }
      : current);
  }

  function handleHeaderBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeaderOwnsFocus(false);
  }

  return (
    <div className={styles.shell}>
      <header
        className={`${styles.topbar} ${headerHidden ? styles.topbarHidden : ''}`}
        data-me-header-hidden={headerHidden ? 'true' : 'false'}
        onFocusCapture={() => setHeaderOwnsFocus(true)}
        onBlurCapture={handleHeaderBlur}
      >
        <Link href="/me" className={styles.brand}>JeloCare</Link>
        <button
          ref={accountTriggerRef}
          className={styles.accountTrigger}
          type="button"
          aria-label="Open account"
          aria-haspopup="dialog"
          aria-controls="me-account-sheet"
          aria-expanded={accountSheetOpen}
          onClick={() => setAccountSheetState({ routeKey: state.routeKey, open: true })}
        >
          <MeAccountAvatarIcon size={23} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>

      <MeAccountSheet
        account={portalViewModel.account}
        shelfItems={portalViewModel.shelf}
        shelfAvailable={portalViewModel.shelfState.status === 'ready'}
        onPreviewClear={shelfState.clearPreviewShelf}
        open={accountSheetOpen}
        onClose={closeAccountSheet}
        triggerRef={accountTriggerRef}
      />

      {route.kind === 'product' && productPanelData ? (
        <ProductQuickPanelSheet
          data={productPanelData}
          open={productPanelOpen}
          tab={productPanelState.tab}
          onTabChange={(tab) => setProductPanelState((current) => ({ ...current, tab }))}
          onClose={closeProductPanel}
          restoreFocusRef={productPanelRestoreFocusRef}
          dialogId="me-product-evidence-sheet"
        />
      ) : null}

      {route.kind !== 'product' ? (
        <MeContextSheet
          model={contextSheetModel}
          open={contextSheetOpen}
          onClose={closeContextSheet}
          triggerRef={contextTriggerRef}
        />
      ) : null}

      <main
        key={state.routeKey}
        className={styles.scroll}
        onScroll={(event) => controller.onScrollPositionChange(event.currentTarget.scrollTop)}
      >
        <div className={styles.content}>
          {shelfState.previewOnly ? (
            <p className={styles.previewNotice} role="status">Preview Shelf · Resets on reload.</p>
          ) : null}
          <p
            ref={shelfMutationStatusRef}
            className={styles.visuallyHidden}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {shelfMutationFeedback.message}
          </p>
          {route.kind === 'home' ? (
            <HomePage
              viewModel={portalViewModel}
              shelfAction={shelfState.shelfAction}
              onShelfMutation={announceShelfMutation}
            />
          ) : null}
          {route.kind === 'explore' ? (
            <ExplorePage
              viewModel={portalViewModel}
              projection={filteredExploreProjection}
              filters={exploreFilters}
              filterOptions={exploreFilterOptions}
              onFiltersChange={setExploreFilters}
              searchRef={searchRef}
              shelfAction={shelfState.shelfAction}
            />
          ) : null}
          {route.kind === 'shelf' ? (
            <ShelfPage
              viewModel={portalViewModel}
              productRequestOutcome={productRequestOutcome}
              productRequestPresentation={productRequestPresentation}
              shelfAction={shelfState.shelfAction}
              onShelfMutation={announceShelfMutation}
            />
          ) : null}
          {route.kind === 'shelf-add' ? (
            <ProductRequestAddPage
              viewModel={portalViewModel}
              shelfAction={shelfState.shelfAction}
              searchRef={searchRef}
            />
          ) : null}
          {route.kind === 'shelf-request' ? (
            <ProductRequestDetailPage
              requestId={route.id}
              synthetic={portalViewModel.account.synthetic}
              initialRequest={productRequestPresentation?.selectedRequest}
              mutationOutcome={productRequestOutcome}
            />
          ) : null}
          {route.kind === 'routine' ? (
            <RoutinePage
              viewModel={portalViewModel}
              mutationOutcome={productRequestOutcome}
            />
          ) : null}
          {route.kind === 'consult' ? (
            <ConsultPage
              viewModel={portalViewModel}
              products={consultProducts}
              search={exploreFilters.search}
              setSearch={(search) => setExploreFilters(current => ({ ...current, search }))}
              searchRef={searchRef}
            />
          ) : null}
          {route.kind === 'product' && product ? (
            <ProductPage
              product={product}
              viewModel={portalViewModel}
              origin={route.origin}
              shelfAction={shelfState.shelfAction}
              onShelfMutation={announceShelfMutation}
              panelOpen={productPanelOpen}
              panelTab={productPanelState.tab}
              onOpenPanel={openProductPanel}
            />
          ) : null}
          {route.kind === 'not-found' ? <MemberNotFoundPage /> : null}
        </div>
      </main>

      <MeWorkspaceDock
        controller={controller}
        currentHref={state.currentHref}
        context={dockContext}
        contextTriggerRef={contextTriggerRef}
        back={back}
      />
    </div>
  );
}

export function MePortal({
  viewModel,
  route,
  productPanelData,
  productRequestOutcome,
  productRequestPresentation,
}: {
  viewModel: CustomerPortalViewModel;
  route: MePortalRoute;
  productPanelData?: ProductPanelData;
  productRequestOutcome?: string;
  productRequestPresentation?: CustomerProductRequestPresentationViewModel;
}) {
  const routeKey = route.kind === 'product'
    ? `/me/product/${route.slug}`
    : route.kind === 'shelf-request'
      ? `/me/shelf/request/${route.id}`
      : route.kind === 'shelf-add'
        ? '/me/shelf/add'
        : route.kind === 'not-found'
          ? '/me/product/not-found'
          : `/me/${route.kind}`;
  return (
    <WorkspaceDockProvider routeKey={route.kind === 'home' ? '/me' : routeKey}>
      <MePortalView
        viewModel={viewModel}
        route={route}
        productPanelData={productPanelData}
        productRequestOutcome={productRequestOutcome}
        productRequestPresentation={productRequestPresentation}
      />
    </WorkspaceDockProvider>
  );
}
