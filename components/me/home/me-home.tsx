'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  ExternalLink,
  LibraryBig,
  MessageCircleQuestion,
  Search,
  Sparkles,
} from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SafeProductImage } from '@/components/products/safe-product-image';
import {
  WorkspaceDockProvider,
  useAdaptiveWorkspaceDockController,
  useWorkspaceDockFabRegistration,
} from '@/components/workspace-shell';
import { createMeDockContext, type MeWorkspacePage } from '@/components/me/shell/me-shell-model';
import { MeAccountAvatarIcon, MeWorkspaceDock } from '@/components/me/shell/me-workspace-dock';
import { authClient } from '@/lib/auth/client';
import type { CustomerPortalProduct, CustomerPortalViewModel } from '@/lib/customer/portal-model';
import styles from './me-home.module.css';

export type MePortalRoute =
  | { kind: 'home' }
  | { kind: 'explore' }
  | { kind: 'shelf' }
  | { kind: 'routine' }
  | { kind: 'consult' }
  | { kind: 'product'; slug: string; origin: 'home' | 'explore' | 'shelf' | 'routine' | 'consult' };

type ProductSource = Extract<MePortalRoute, { kind: 'product' }>['origin'];
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
  );
}

function ExploreCard({ product, source = 'explore' }: {
  product: CustomerPortalProduct;
  source?: ProductSource;
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
    </article>
  );
}

function AccountMenu({ account }: { account: CustomerPortalViewModel['account'] }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!account.synthetic) {
        const result = await authClient.signOut();
        if (result.error) throw result.error;
      }
      window.location.assign('/sign-in?next=/me');
    } catch (err) {
      console.error('customer-sign-out', err);
      setError('Could not sign out. Try again.');
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !detailsRef.current?.open) return;
    event.preventDefault();
    detailsRef.current.open = false;
    summaryRef.current?.focus();
  }

  return (
    <details ref={detailsRef} className={styles.account} onKeyDown={handleKeyDown}>
      <summary ref={summaryRef} aria-label="Open account">
        <MeAccountAvatarIcon size={23} strokeWidth={1.7} aria-hidden="true" />
      </summary>
      <section className={styles.accountPanel} aria-label="Account">
        <span className={styles.accountOrb} aria-hidden="true">
          <MeAccountAvatarIcon size={24} strokeWidth={1.6} />
        </span>
        <div>
          <small>Account</small>
          <strong>{account.displayName ?? 'Your JeloCare'}</strong>
          {account.email ? <span>{account.email}</span> : null}
        </div>
        <button type="button" onClick={() => void signOut()} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </details>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link className={styles.backLink} href={href}>
      <ArrowLeft size={17} aria-hidden="true" /> Back
    </Link>
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
    return { routeKey: '/me', currentHref: '/me', page: 'home' as MeWorkspacePage, detail: 'Your care' };
  }
  if (route.kind === 'explore') {
    return { routeKey: '/me/explore', currentHref: '/me/explore', page: 'explore' as MeWorkspacePage, detail: 'Exact catalogue' };
  }
  if (route.kind === 'shelf') {
    return { routeKey: '/me/shelf', currentHref: '/me/shelf', page: 'shelf' as MeWorkspacePage, detail: count(viewModel.shelf.length, 'saved product') };
  }
  if (route.kind === 'routine') {
    return { routeKey: '/me/routine', currentHref: '/me/routine', page: 'routine' as MeWorkspacePage, detail: count(viewModel.routine.length, 'saved step') };
  }
  if (route.kind === 'consult') {
    return { routeKey: '/me/consult', currentHref: '/me', page: 'consult' as MeWorkspacePage, detail: 'Your care context' };
  }
  return {
    routeKey: `/me/product/${route.slug}`,
    currentHref: route.origin === 'home' || route.origin === 'consult'
      ? '/me'
      : `/me/${route.origin}`,
    page: 'product' as MeWorkspacePage,
    detail: 'Exact catalogue record',
  };
}

function HomePage({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  return (
    <>
      <section className={styles.hero} aria-labelledby="me-home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>JeloCare Me</p>
          <h1 id="me-home-title">Care, closer.</h1>
          <p>Ask one question, keep what matters, and return when you need it.</p>
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
          <p className={styles.eyebrow}>Shelf</p>
          <h2 id="me-shelf-preview-title">Saved, within reach.</h2>
          <Link className={styles.sectionLink} href={'/me/shelf'}>Open Shelf <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {viewModel.shelf.length ? (
          <div className={styles.productGrid}>
            {viewModel.shelf.slice(0, 3).map((product) => (
              <ProductListCard key={product.slug} product={product} source="shelf" />
            ))}
          </div>
        ) : (
          <div className={styles.emptyAction}>
            <LibraryBig size={24} strokeWidth={1.5} aria-hidden="true" />
            <p>Your shelf is ready when you save an exact product.</p>
            <Link href="/me/explore">Explore products</Link>
          </div>
        )}
      </section>

      <section className={`${styles.section} ${styles.routineSurface}`} aria-labelledby="me-routine-preview-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{viewModel.routineProvenance ?? 'Routine'}</p>
          <h2 id="me-routine-preview-title">Your steps, kept together.</h2>
          <Link className={styles.sectionLink} href={'/me/routine'}>Open Routine <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <RoutineList viewModel={viewModel} />
      </section>
    </>
  );
}

function ExplorePage({
  products,
  search,
  setSearch,
  searchRef,
}: {
  products: readonly CustomerPortalProduct[];
  search: string;
  setSearch: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <section className={styles.routePage} aria-labelledby="me-explore-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>Explore</p>
        <h1 id="me-explore-title">Find your next exact product.</h1>
        <p>Browse JeloCare’s reviewed catalogue without mixing discovery into your Shelf.</p>
      </div>
      <SearchField value={search} onChange={setSearch} inputRef={searchRef} label="Search exact products" />
      {products.length ? (
        <div className={styles.exploreGrid}>
          {products.map((product) => <ExploreCard key={product.slug} product={product} />)}
        </div>
      ) : (
        <p className={styles.empty}>No exact products match that search.</p>
      )}
    </section>
  );
}

function ShelfPage({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  return (
    <section className={styles.routePage} aria-labelledby="me-shelf-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>Shelf</p>
        <h1 id="me-shelf-title">What you chose to keep.</h1>
        <p>Only exact products you saved belong here.</p>
      </div>
      {viewModel.shelf.length ? (
        <div className={`${styles.productGrid} ${styles.listPage}`}>
          {viewModel.shelf.map((product) => <ProductListCard key={product.slug} product={product} source="shelf" />)}
        </div>
      ) : (
        <div className={styles.emptyAction}>
          <LibraryBig size={24} strokeWidth={1.5} aria-hidden="true" />
          <p>Your Shelf is empty.</p>
          <Link href="/me/explore">Explore products</Link>
        </div>
      )}
    </section>
  );
}

function RoutineList({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  if (!viewModel.routine.length) return <p className={styles.empty}>No routine yet. Your choices stay yours.</p>;
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
  return (
    <section className={styles.routePage} aria-labelledby="me-routine-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{viewModel.routineProvenance ?? 'Routine'}</p>
        <h1 id="me-routine-title">Your saved order.</h1>
        <p>A quiet view of the steps you arranged.</p>
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
  return (
    <section className={`${styles.routePage} ${styles.stackPage}`} aria-labelledby="me-consult-title">
      <BackLink href="/me" />
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>Ask Me</p>
        <h1 id="me-consult-title">Start with what matters.</h1>
        <p>Search your care context and open the exact product you want to understand.</p>
      </div>
      <SearchField value={search} onChange={setSearch} inputRef={searchRef} label="Search your care" />
      {viewModel.concerns.length ? (
        <div className={styles.concernList} aria-label="Your concerns">
          {viewModel.concerns.map((concern) => <span key={concern}>{concern}</span>)}
        </div>
      ) : null}
      <div className={styles.exploreGrid}>
        {products.slice(0, 6).map((product) => <ExploreCard key={product.slug} product={product} source="consult" />)}
      </div>
    </section>
  );
}

function ProductPage({
  product,
  route,
  viewModel,
}: {
  product: CustomerPortalProduct;
  route: Extract<MePortalRoute, { kind: 'product' }>;
  viewModel: CustomerPortalViewModel;
}) {
  const onShelf = viewModel.shelf.some((item) => item.slug === product.slug);
  const routineStep = viewModel.routine.find((step) => step.product.slug === product.slug);
  const backHref = route.origin === 'home'
    ? '/me'
    : route.origin === 'consult'
      ? '/me/consult'
      : `/me/${route.origin}`;
  return (
    <article className={`${styles.routePage} ${styles.stackPage} ${styles.productPage}`} aria-labelledby="me-product-title">
      <BackLink href={backHref} />
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
          <Link className={styles.publicLink} href={`/products/${product.slug}`}>
            Public product evidence <ExternalLink size={16} aria-hidden="true" />
          </Link>
          <div className={styles.productMeta} aria-label="Product and customer context">
            <span>{product.size}</span>
            <span>{product.category}</span>
            <span>{product.step}</span>
            <span>
              {onShelf ? 'On your Shelf' : 'Not on Shelf'} · {routineStep ? 'In your Routine' : 'Not in Routine'}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function MePortalView({
  viewModel,
  route,
}: {
  viewModel: CustomerPortalViewModel;
  route: MePortalRoute;
}) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const state = routeState(route, viewModel);
  const controller = useAdaptiveWorkspaceDockController({
    routeKey: state.routeKey,
    hasNavigation: true,
    hasContext: true,
  });
  const catalogue = viewModel.catalogue ?? EMPTY_PRODUCTS;
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
  const focusSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchRef.current?.focus({ preventScroll: true });
  };

  useWorkspaceDockFabRegistration(route.kind === 'home' ? {
    ownerId: 'me-home-consult',
    routeKey: state.routeKey,
    label: 'Ask Me',
    icon: MessageCircleQuestion,
    onInvoke: () => window.location.assign('/me/consult'),
  } : route.kind === 'explore' || route.kind === 'consult' ? {
    ownerId: `me-${route.kind}-search`,
    routeKey: state.routeKey,
    label: 'Search products',
    icon: Search,
    onInvoke: focusSearch,
  } : route.kind === 'shelf' ? {
    ownerId: 'me-shelf-explore',
    routeKey: state.routeKey,
    label: 'Explore products',
    icon: Compass,
    onInvoke: () => window.location.assign('/me/explore'),
  } : route.kind === 'product' && product ? {
    ownerId: 'me-product-public-evidence',
    routeKey: state.routeKey,
    label: 'Open public product evidence',
    icon: ExternalLink,
    onInvoke: () => window.location.assign(`/products/${product.slug}`),
  } : null);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/me" className={styles.brand}>JeloCare</Link>
        <AccountMenu account={viewModel.account} />
      </header>

      <main
        className={styles.scroll}
        onScroll={(event) => controller.onScrollPositionChange(event.currentTarget.scrollTop)}
      >
        <div className={styles.content}>
          {route.kind === 'home' ? <HomePage viewModel={viewModel} /> : null}
          {route.kind === 'explore' ? (
            <ExplorePage products={filteredProducts} search={search} setSearch={setSearch} searchRef={searchRef} />
          ) : null}
          {route.kind === 'shelf' ? <ShelfPage viewModel={viewModel} /> : null}
          {route.kind === 'routine' ? <RoutinePage viewModel={viewModel} /> : null}
          {route.kind === 'consult' ? (
            <ConsultPage
              viewModel={viewModel}
              products={filteredProducts}
              search={search}
              setSearch={setSearch}
              searchRef={searchRef}
            />
          ) : null}
          {route.kind === 'product' && product ? (
            <ProductPage product={product} route={route} viewModel={viewModel} />
          ) : null}
        </div>
      </main>

      <MeWorkspaceDock controller={controller} currentHref={state.currentHref} context={context} />
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
  const routeKey = route.kind === 'product' ? `/me/product/${route.slug}` : `/me/${route.kind}`;
  return (
    <WorkspaceDockProvider routeKey={route.kind === 'home' ? '/me' : routeKey}>
      <MePortalView viewModel={viewModel} route={route} />
    </WorkspaceDockProvider>
  );
}
