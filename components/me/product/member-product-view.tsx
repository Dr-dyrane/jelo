'use client';

import { Info, ShoppingBag } from 'lucide-react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { MeProductOrigin } from '@/components/me/shell/me-shell-model';
import type { CustomerPortalProduct, CustomerPortalViewModel } from '@/lib/customer/portal-model';
import type { CustomerProductReadModel } from '@/lib/customer/route-read-models';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import type { ProductPanelTab } from '@/lib/catalogue/product-panel-model';
import styles from '../home/me-home.module.css';

export function MemberProductView({
  product,
  productReadModel,
  viewModel,
  origin,
  shelfAction,
  onShelfMutation,
  panelOpen,
  panelTab,
  onOpenPanel,
}: {
  product: CustomerPortalProduct;
  productReadModel?: CustomerProductReadModel;
  viewModel: CustomerPortalViewModel;
  origin: MeProductOrigin;
  shelfAction?: ShelfActionHandler;
  onShelfMutation: (result: CustomerShelfActionResult) => void;
  panelOpen: boolean;
  panelTab: ProductPanelTab;
  onOpenPanel: (tab: ProductPanelTab, opener?: HTMLElement | null) => void;
}) {
  const shelfItem = productReadModel?.shelfItem
    ?? viewModel.shelf.find((item) => item.product?.slug === product.slug);
  const shelfAvailable = (productReadModel?.shelfState ?? viewModel.shelfState).status === 'ready';
  const fromShelf = origin === 'shelf';
  const showShelfAction = shelfAvailable && (!fromShelf || Boolean(shelfItem));
  const reading = productReadModel?.marketReading;
  const routineContext = productReadModel?.routineContext;
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
          {reading ? (
            <div className={styles.marketReading} aria-label="Market reading">
              {reading.state === 'priced' ? (
                <>
                  <p className={styles.marketPrice}>{reading.priceLabel}</p>
                  <p className={styles.marketStores}>
                    {reading.storeCount} {reading.storeCount === 1 ? 'observed store' : 'observed stores'}
                  </p>
                  {reading.freshnessLabel ? <p className={styles.marketFreshness}>{reading.freshnessLabel}</p> : null}
                </>
              ) : reading.state === 'listing-only' ? (
                <>
                  <p className={styles.marketPrice}>Current price unavailable</p>
                  <p className={styles.marketStores}>
                    {reading.listingStoreCount} {reading.listingStoreCount === 1 ? 'observed store' : 'observed stores'}
                  </p>
                  {reading.freshnessLabel ? <p className={styles.marketFreshness}>{reading.freshnessLabel}</p> : null}
                </>
              ) : (
                <p className={styles.marketPrice}>No current Nigerian store evidence</p>
              )}
            </div>
          ) : null}
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
          <div className={styles.productMeta} aria-label="Product details">
            <span>{product.size}</span>
            <span>{product.category}</span>
            <span>{product.step}</span>
          </div>
          {routineContext || shelfItem ? (
            <div className={styles.productPersonalContext} aria-label="My product context">
              {shelfAvailable ? (
                <span>{shelfItem ? 'On my Shelf' : 'Not on my Shelf'}</span>
              ) : (
                <span>Shelf unavailable</span>
              )}
              {routineContext ? <span>{routineContext.label}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
