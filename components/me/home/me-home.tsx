'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Compass,
  ExternalLink,
  MessageCircleQuestion,
  Pipette,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import {
  useMeShelfState,
  type ShelfActionHandler,
} from '@/components/me/shelf/me-shelf-state';
import { SafeProductImage } from '@/components/products/safe-product-image';
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
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import styles from './me-home.module.css';

type ProductSource = MeProductOrigin;
const EMPTY_PRODUCTS: readonly CustomerPortalProduct[] = [];

function memberProductHref(product: CustomerPortalProduct, source?: ProductSource) {
  const pathname = `/me/product/${product.slug}`;
  return source ? `${pathname}?from=${source}` : pathname;
}

function ProductListCard({
  product,
  source,
}: {
  product: CustomerPortalProduct;
  source: ProductSource;
}) {
  return (
    <article className={styles.productCardShell}>
      <Link className={styles.productCard} href={memberProductHref(product, source)}>
        <span className={styles.productImage}>
          <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
        </span>
        <span className={styles.productCopy}>
          <small>{product.brand}</small>
          <strong>{product.name}</strong>
          <span>{product.category} · {product.size}</span>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </article>
  );
}

function ExploreCard({ product, source = 'explore', shelfItem, showShelfAction = false, shelfAction }: {
  product: CustomerPortalProduct;
  source?: ProductSource;
  shelfItem?: CustomerPortalShelfItem;
  showShelfAction?: boolean;
  shelfAction?: ShelfActionHandler;
}) {
  return (
    <article className={styles.exploreCard}>
      <Link href={memberProductHref(product, source)} aria-label={`${product.brand} ${product.name}`}>
        <span className={styles.exploreVisual}>
          <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
        </span>
        <span className={styles.exploreCopy}>
          <small>{product.brand}</small>
          <strong>{product.name}</strong>
          <span className={styles.exploreMeta}>
            <span>{product.size}</span>
            {product.priceLabel ? <span>{product.priceLabel}</span> : null}
          </span>
        </span>
      </Link>
      {showShelfAction ? (
        <ShelfActionButton
          productSlug={product.slug}
          saved={Boolean(shelfItem)}
          placement="explore"
          onAction={shelfAction}
        />
      ) : null}
    </article>
  );
}

function UnavailableShelfCard({ item }: { item: CustomerPortalShelfItem }) {
  return (
    <article className={`${styles.productCardShell} ${styles.unavailableProduct}`}>
      <div className={styles.unavailableCopy}>
        <small>{item.snapshot.brand}</small>
        <strong>{item.snapshot.name}</strong>
        <span>{item.snapshot.size} · {item.availability === 'changed' ? 'Changed' : 'Unavailable'}</span>
        {item.message ? <p>{item.message}</p> : null}
      </div>
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
    return { routeKey: '/me/routine', currentHref: resolveMeActiveParentHref(route), page: 'routine' as MeWorkspacePage, detail: count(viewModel.routine.length, 'saved step') };
  }
  if (route.kind === 'consult') {
    return { routeKey: '/me/consult', currentHref: resolveMeActiveParentHref(route), page: 'consult' as MeWorkspacePage, detail: 'My care' };
  }
  if (route.kind === 'not-found') {
    return { routeKey: '/me/product/not-found', currentHref: resolveMeActiveParentHref(route), page: 'not-found' as MeWorkspacePage, detail: 'Product not found' };
  }
  return {
    routeKey: `/me/product/${route.slug}`,
    currentHref: resolveMeActiveParentHref(route),
    page: 'product' as MeWorkspacePage,
    detail: 'Exact catalogue record',
  };
}

function HomePage({ viewModel }: { viewModel: CustomerPortalViewModel }) {
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
          <div className={styles.productGrid}>
            {viewModel.shelf.slice(0, 3).map((item) => item.product ? (
              <ProductListCard
                key={item.identityVersionId}
                product={item.product}
                source="shelf"
              />
            ) : (
              <UnavailableShelfCard
                key={item.identityVersionId}
                item={item}
              />
            ))}
          </div>
        ) : viewModel.shelfState.status === 'unavailable' ? (
          <div className={styles.emptyAction} role="status">
            <Pipette size={24} strokeWidth={1.5} aria-hidden="true" />
            <p>{viewModel.shelfState.message}</p>
            <Link href="/me">Try again</Link>
          </div>
        ) : (
          <div className={styles.emptyAction}>
            <Pipette size={24} strokeWidth={1.5} aria-hidden="true" />
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

function ExplorePage({
  viewModel,
  products,
  search,
  setSearch,
  searchRef,
  shelfAction,
}: {
  viewModel: CustomerPortalViewModel;
  products: readonly CustomerPortalProduct[];
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shelfAction?: ShelfActionHandler;
}) {
  const surface = ME_PORTAL_SURFACES.explore;
  return (
    <section className={styles.routePage} aria-labelledby="me-explore-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-explore-title">{surface.title}</h1>
      </div>
      <SearchField value={search} onChange={setSearch} inputRef={searchRef} label="Search exact products" />
      {products.length ? (
        <div className={styles.exploreGrid}>
          {products.map((product) => (
            <ExploreCard
              key={product.slug}
              product={product}
              shelfItem={viewModel.shelf.find(item => item.product?.slug === product.slug)}
              showShelfAction={viewModel.shelfState.status === 'ready'}
              shelfAction={shelfAction}
            />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No exact products match that search.</p>
      )}
    </section>
  );
}

function ShelfPage({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  const surface = ME_PORTAL_SURFACES.shelf;
  return (
    <section className={styles.routePage} aria-labelledby="me-shelf-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-shelf-title">{surface.title}</h1>
      </div>
      {viewModel.shelfState.status === 'unavailable' ? (
        <div className={styles.emptyAction} role="status">
          <Pipette size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>{viewModel.shelfState.message}</p>
          <Link href="/me/shelf">Try again</Link>
        </div>
      ) : viewModel.shelf.length ? (
        <div className={`${styles.productGrid} ${styles.listPage}`}>
          {viewModel.shelf.map((item) => item.product ? (
            <ProductListCard
              key={item.identityVersionId}
              product={item.product}
              source="shelf"
            />
          ) : (
            <UnavailableShelfCard
              key={item.identityVersionId}
              item={item}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyAction}>
          <Pipette size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>Nothing saved yet.</p>
          <Link href="/me/explore">Explore products</Link>
        </div>
      )}
    </section>
  );
}

function RoutineList({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  if (!viewModel.routine.length) return <p className={styles.empty}>No routine yet.</p>;
  return (
    <ol className={styles.routineList}>
      {viewModel.routine.map((step, index) => (
        <li key={step.id}>
          <Link href={memberProductHref(step.product, 'routine')} aria-label={`View ${step.product.name}`}>
            <span className={styles.routineImage}>
              <SafeProductImage src={step.product.image} alt={`${step.product.brand} ${step.product.name}`} />
            </span>
            <span className={styles.routineNumber}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.routineCopy}>
              <small>{step.moment}</small>
              <strong>{step.product.brand} {step.product.name}</strong>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function RoutinePage({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  const surface = ME_PORTAL_SURFACES.routine;
  return (
    <section className={styles.routePage} aria-labelledby="me-routine-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{viewModel.routineProvenance ?? surface.eyebrow}</p>
        <h1 id="me-routine-title">{surface.title}</h1>
      </div>
      <RoutineList viewModel={viewModel} />
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
      <SearchField value={search} onChange={setSearch} inputRef={searchRef} label="Search my care" />
      {viewModel.concerns.length ? (
        <div className={styles.concernList} aria-label="My concerns">
          {viewModel.concerns.map((concern) => <span key={concern}>{concern}</span>)}
        </div>
      ) : null}
      <div className={styles.exploreGrid}>
        {products.slice(0, 6).map((product) => <ExploreCard key={product.slug} product={product} source="home" />)}
      </div>
    </section>
  );
}

function ProductPage({
  product,
  viewModel,
  origin,
  shelfAction,
  mutationFeedback,
  mutationStatusRef,
  onShelfMutation,
}: {
  product: CustomerPortalProduct;
  viewModel: CustomerPortalViewModel;
  origin: MeProductOrigin;
  shelfAction?: ShelfActionHandler;
  mutationFeedback: string;
  mutationStatusRef: React.RefObject<HTMLParagraphElement | null>;
  onShelfMutation: (result: CustomerShelfActionResult) => void;
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
            <Link className={styles.publicLink} href={`/products/${product.slug}`}>
              View product <ExternalLink size={16} aria-hidden="true" />
            </Link>
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
            {fromShelf ? (
              <p
                ref={mutationStatusRef}
                className={styles.visuallyHidden}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {mutationFeedback}
              </p>
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
}: {
  viewModel: CustomerPortalViewModel;
  route: MePortalRoute;
}) {
  const router = useRouter();
  const shelfState = useMeShelfState(viewModel);
  const portalViewModel = shelfState.viewModel;
  const [search, setSearch] = useState('');
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
  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = useMemo(() => catalogue.filter((product) => {
    if (!normalizedSearch) return true;
    return [product.brand, product.name, product.category, product.step, product.displayLine]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  }).slice(0, 12), [catalogue, normalizedSearch]);
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
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [accountSheetState, setAccountSheetState] = useState(() => ({
    routeKey: state.routeKey,
    open: false,
  }));
  const [headerOwnsFocus, setHeaderOwnsFocus] = useState(false);
  const contextSheetOpen = contextSheetState.routeKey === state.routeKey && contextSheetState.open;
  const accountSheetOpen = accountSheetState.routeKey === state.routeKey && accountSheetState.open;
  const contextSheetModel = createMeContextSheetModel({
    route,
    viewModel: portalViewModel,
    visibleProductCount: filteredProducts.length,
    product,
  });
  const dockContext = {
    ...context,
    accessibleLabel: `Open ${context.label} summary. ${context.detail}`,
    controls: 'me-context-sheet',
    expanded: contextSheetOpen,
    onInvoke: () => setContextSheetState({ routeKey: state.routeKey, open: true }),
  };
  const headerHidden = resolveMeHeaderHidden({
    chromeHidden: controller.scroll.chromeHidden,
    accountSheetOpen: accountSheetOpen || contextSheetOpen,
    headerOwnsFocus,
  });
  useEffect(() => {
    if (
      route.kind !== 'product'
      || route.origin !== 'shelf'
      || !shelfMutationFeedback.message
    ) return;
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
    : state.page === 'explore' || state.page === 'consult'
      ? Search
      : state.page === 'product'
        ? ExternalLink
        : Compass;

  const invokeFab = () => {
    if (fabContract.action === 'focus-search') {
      focusSearch();
      return;
    }
    if (fabContract.action === 'public-product') {
      window.location.assign(`/products/${route.kind === 'product' ? route.slug : ''}`);
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

      <MeContextSheet
        model={contextSheetModel}
        open={contextSheetOpen}
        onClose={closeContextSheet}
        triggerRef={contextTriggerRef}
      />

      <main
        key={state.routeKey}
        className={styles.scroll}
        onScroll={(event) => controller.onScrollPositionChange(event.currentTarget.scrollTop)}
      >
        <div className={styles.content}>
          {shelfState.previewOnly ? (
            <p className={styles.previewNotice} role="status">Preview Shelf · Resets on reload.</p>
          ) : null}
          {route.kind === 'home' ? <HomePage viewModel={portalViewModel} /> : null}
          {route.kind === 'explore' ? (
            <ExplorePage
              viewModel={portalViewModel}
              products={filteredProducts}
              search={search}
              setSearch={setSearch}
              searchRef={searchRef}
              shelfAction={shelfState.shelfAction}
            />
          ) : null}
          {route.kind === 'shelf' ? <ShelfPage viewModel={portalViewModel} /> : null}
          {route.kind === 'routine' ? <RoutinePage viewModel={portalViewModel} /> : null}
          {route.kind === 'consult' ? (
            <ConsultPage
              viewModel={portalViewModel}
              products={filteredProducts}
              search={search}
              setSearch={setSearch}
              searchRef={searchRef}
            />
          ) : null}
          {route.kind === 'product' && product ? (
            <ProductPage
              product={product}
              viewModel={portalViewModel}
              origin={route.origin}
              shelfAction={shelfState.shelfAction}
              mutationFeedback={shelfMutationFeedback.message}
              mutationStatusRef={shelfMutationStatusRef}
              onShelfMutation={announceShelfMutation}
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
}: {
  viewModel: CustomerPortalViewModel;
  route: MePortalRoute;
}) {
  const routeKey = route.kind === 'product'
    ? `/me/product/${route.slug}`
    : route.kind === 'not-found'
      ? '/me/product/not-found'
      : `/me/${route.kind}`;
  return (
    <WorkspaceDockProvider routeKey={route.kind === 'home' ? '/me' : routeKey}>
      <MePortalView viewModel={viewModel} route={route} />
    </WorkspaceDockProvider>
  );
}
