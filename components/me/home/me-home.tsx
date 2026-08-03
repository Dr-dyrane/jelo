'use client';

import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  MessageCircleQuestion,
  PackageOpen,
  Sparkles,
} from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import type {
  CustomerPortalProduct,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import { SafeProductImage } from '@/components/products/safe-product-image';
import {
  WorkspaceDockProvider,
  useAdaptiveWorkspaceDockController,
  useWorkspaceDockFabRegistration,
} from '@/components/workspace-shell';
import { createMeDockContext } from '@/components/me/shell/me-shell-model';
import {
  MeAccountAvatarIcon,
  MeWorkspaceDock,
} from '@/components/me/shell/me-workspace-dock';
import styles from './me-home.module.css';

function ProductCard({ product }: { product: CustomerPortalProduct }) {
  return (
    <Link className={styles.productCard} href={`/products/${product.slug}`}>
      <span className={styles.productImage}>
        <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
      </span>
      <span className={styles.productCopy}>
        <small>{product.brand}</small>
        <strong>{product.name}</strong>
        <span>{product.category} · {product.size}</span>
      </span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
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

function MeHomeView({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  const context = createMeDockContext({
    tab: 'ask',
    detail: viewModel.account.displayName ? `${viewModel.account.displayName}'s care` : 'Your care',
  });
  const controller = useAdaptiveWorkspaceDockController({
    routeKey: '/me',
    hasNavigation: true,
    hasContext: true,
  });

  useWorkspaceDockFabRegistration({
    ownerId: 'me-ask',
    routeKey: '/me',
    label: 'Ask JeloCare',
    icon: MessageCircleQuestion,
    onInvoke: () => window.location.assign('/consult'),
  });

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>JeloCare</Link>
        <AccountMenu account={viewModel.account} />
      </header>

      <main
        className={styles.scroll}
        onScroll={(event) => controller.onScrollPositionChange(event.currentTarget.scrollTop)}
      >
        <div className={styles.content}>
          <section className={styles.hero} aria-labelledby="me-home-title">
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>JeloCare Me</p>
              <h1 id="me-home-title">Care, closer.</h1>
              <p>Ask one question, keep what matters, and return when you need it.</p>
              <Link className={styles.primaryAction} href="/consult">
                Ask about your care <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>

            {viewModel.featuredProduct ? (
              <Link
                className={styles.heroProduct}
                href={`/products/${viewModel.featuredProduct.slug}`}
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

          <section className={`${styles.section} ${styles.concerns}`} aria-labelledby="me-concerns-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Concerns</p>
              <h2 id="me-concerns-title">What you’re keeping in view.</h2>
            </div>
            {viewModel.concerns.length ? (
              <div className={styles.concernList}>
                {viewModel.concerns.map((concern) => <span key={concern}>{concern}</span>)}
              </div>
            ) : (
              <p className={styles.empty}>Nothing here yet. <Link href="/concerns">Browse concern guides</Link>.</p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="me-shelf-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Shelf</p>
              <h2 id="me-shelf-title">Exact products, easy to find.</h2>
            </div>
            {viewModel.shelf.length ? (
              <div className={styles.productGrid}>
                {viewModel.shelf.map((product) => <ProductCard key={product.slug} product={product} />)}
              </div>
            ) : (
              <div className={styles.emptyAction}>
                <PackageOpen size={24} strokeWidth={1.5} aria-hidden="true" />
                <p>Your shelf is ready when you save an exact product.</p>
                <Link href="/products">Browse products</Link>
              </div>
            )}
          </section>

          <section className={`${styles.section} ${styles.routine}`} aria-labelledby="me-routine-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Routine</p>
              <h2 id="me-routine-title">A quiet view of what comes next.</h2>
            </div>
            {viewModel.routine.length ? (
              <div className={styles.routineContent}>
                {viewModel.routineProvenance ? (
                  <p className={styles.routineProvenance}>{viewModel.routineProvenance}</p>
                ) : null}
                <ol className={styles.routineList}>
                  {viewModel.routine.map((step, index) => (
                    <li key={step.id}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <small>{step.moment}</small>
                        <strong>{step.product.brand} {step.product.name}</strong>
                      </div>
                      <Link href={`/products/${step.product.slug}`} aria-label={`View ${step.product.name}`}>
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className={styles.empty}>No routine yet. Your choices stay yours.</p>
            )}
          </section>
        </div>
      </main>

      <MeWorkspaceDock
        controller={controller}
        currentHref="/me"
        context={context}
        onNavigate={(_item, event) => event.preventDefault()}
      />
    </div>
  );
}

export function MeHome({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  return (
    <WorkspaceDockProvider routeKey="/me">
      <MeHomeView viewModel={viewModel} />
    </WorkspaceDockProvider>
  );
}
