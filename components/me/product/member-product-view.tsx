'use client';

import { Info, ShoppingBag } from 'lucide-react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { MeProductOrigin } from '@/components/me/shell/me-shell-model';
import type {
  CustomerPortalProduct,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import type { ProductPanelTab } from '@/lib/catalogue/product-panel-model';
import styles from '../home/me-home.module.css';

export function MemberProductView({
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
