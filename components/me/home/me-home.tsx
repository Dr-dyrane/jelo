'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClockPlus,
  Compass,
  MessageCircleQuestion,
  PackagePlus,
  Search,
  ShelvingUnit,
  ShoppingBag,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import {
  PrivateProductRequestShelf,
  ProductRequestAddPage,
  ProductRequestDetailPage,
} from '@/components/me/product-requests/product-request-experience';
import {
  useMeShelfState,
  type ShelfActionHandler,
} from '@/components/me/shelf/me-shelf-state';
import { ProductCard } from '@/components/products/product-card';
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
  type MeWorkspacePage,
} from '@/components/me/shell/me-shell-model';
import { MeAccountAvatarIcon, MeWorkspaceDock } from '@/components/me/shell/me-workspace-dock';
import { ConsultView } from '@/components/me/consult/consult-view';
import { MemberProductView } from '@/components/me/product/member-product-view';
import { MemberNotFoundView } from '@/components/me/product/member-not-found-view';
import { HomeView } from '@/components/me/home/home-view';
import { ExploreView } from '@/components/me/explore/explore-view';
import { RoutineView } from '@/components/me/routine/routine-view';
import {
  memberProductHref,
  UnavailableShelfCard,
} from '@/components/me/home/shared-views';
import type {
  CustomerPortalProduct,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import {
  clearCustomerExploreFilters,
  createCustomerExploreFilterOptions,
  createCustomerExploreProjection,
  filterCustomerExplore,
  flattenCustomerExplore,
  type CustomerExploreFilterState,
} from '@/lib/customer/explore-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import type { CustomerProductRequestPresentationViewModel } from '@/lib/customer/product-request-model';
import type { ProductPanelData, ProductPanelTab } from '@/lib/catalogue/product-panel-model';
import styles from './me-home.module.css';

const EMPTY_PRODUCTS: readonly CustomerPortalProduct[] = [];

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
            <HomeView
              viewModel={portalViewModel}
              shelfAction={shelfState.shelfAction}
              onShelfMutation={announceShelfMutation}
            />
          ) : null}
          {route.kind === 'explore' ? (
            <ExploreView
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
            <RoutineView
              viewModel={portalViewModel}
              mutationOutcome={productRequestOutcome}
            />
          ) : null}
          {route.kind === 'consult' ? (
            <ConsultView
              viewModel={portalViewModel}
              products={consultProducts}
              search={exploreFilters.search}
              setSearch={(search) => setExploreFilters(current => ({ ...current, search }))}
              searchRef={searchRef}
            />
          ) : null}
          {route.kind === 'product' && product ? (
            <MemberProductView
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
          {route.kind === 'not-found' ? <MemberNotFoundView /> : null}
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
