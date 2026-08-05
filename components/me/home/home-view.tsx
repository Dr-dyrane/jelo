'use client';

import Link from 'next/link';
import { ArrowRight, ShelvingUnit, Sparkles } from 'lucide-react';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { ProductCard } from '@/components/products/product-card';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import { memberProductHref, UnavailableShelfCard, RoutineRail } from './shared-views';
import styles from './me-home.module.css';

export function HomeView({
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

      <section className={styles.fullSection} aria-labelledby="me-shelf-preview-title">
        <div className={styles.fullSectionHeading}>
          <div>
            <p className={styles.eyebrow}>Saved products</p>
            <h2 id="me-shelf-preview-title">My Shelf.</h2>
          </div>
          <Link className={styles.fullSectionLink} href={'/me/shelf'}>Open Shelf <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {viewModel.shelf.length ? (
          <div className="product-rail">
            {viewModel.shelf.slice(0, 6).map((item) => item.product ? (
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

      <section className={`${styles.fullSection} ${styles.routineSurface}`} aria-labelledby="me-routine-preview-title">
        <div className={styles.fullSectionHeading}>
          <div>
            <p className={styles.eyebrow}>{viewModel.routineProvenance ?? 'My Routine'}</p>
            <h2 id="me-routine-preview-title">My steps.</h2>
          </div>
          <Link className={styles.fullSectionLink} href={'/me/routine'}>Open Routine <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <RoutineRail viewModel={viewModel} />
      </section>
    </>
  );
}
