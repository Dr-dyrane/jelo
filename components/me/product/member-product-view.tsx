"use client";

import { Info, ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { ShelfActionButton } from "@/components/me/shelf/shelf-action-button";
import { SafeProductImage } from "@/components/products/safe-product-image";
import type { MeProductOrigin } from "@/components/me/shell/me-shell-model";
import type {
  CustomerPortalProduct,
  CustomerPortalViewModel,
} from "@/lib/customer/portal-model";
import type { CustomerProductReadModel } from "@/lib/customer/route-read-models";
import {
  deriveProductShelfContext,
  shelfContextLabel,
} from "@/lib/customer/product-shelf-context";
import type { CustomerShelfActionResult } from "@/lib/customer/shelf-service";
import type { ShelfActionHandler } from "@/components/me/shelf/me-shelf-state";
import type { ProductPanelTab } from "@/lib/catalogue/product-panel-model";
import styles from "../home/me-home.module.css";

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
  // Derive shelf context from the live view model shelf, not the stale server
  // read model. In synthetic preview mode, viewModel.shelf is the live preview
  // shelf owned by useMeShelfState — so Add/Remove/Clear converge immediately.
  // In production, viewModel.shelf reflects the server-rendered items until a
  // router.refresh() replaces them.
  const shelfAvailable = viewModel.shelfState.status === "ready";
  const shelfContext = useMemo(
    () =>
      deriveProductShelfContext(
        viewModel.shelf,
        product.slug,
        shelfAvailable,
        viewModel.shelfState.status === "unavailable"
          ? viewModel.shelfState.message
          : null,
      ),
    [viewModel.shelf, product.slug, shelfAvailable, viewModel.shelfState],
  );
  const fromShelf = origin === "shelf";
  const showShelfAction =
    shelfAvailable &&
    (!fromShelf ||
      Boolean(
        shelfContext &&
        (shelfContext.state === "saved-current" ||
          shelfContext.state === "saved-changed"),
      ));
  const reading = productReadModel?.marketReading;
  const routineContext = productReadModel?.routineContext;

  // For the ShelfActionButton, we need the shelf item if saved
  const shelfItem =
    shelfContext?.state === "saved-current" ||
    shelfContext?.state === "saved-changed"
      ? shelfContext.shelfItem
      : undefined;

  // Personal context line: placed directly below the display line
  const shelfLabel = shelfContext ? shelfContextLabel(shelfContext) : null;
  const routineLabel = routineContext?.label ?? null;
  const matchedConcerns = viewModel.concerns.filter((concern) =>
    product.supportedConcernSlugs.includes(concern.slug),
  );
  const concernLabel = matchedConcerns.length
    ? `Matches your ${matchedConcerns.map((c) => c.name).join(" and ")} concern${matchedConcerns.length === 1 ? "" : "s"}`
    : null;
  const hasPersonalContext = shelfLabel || routineLabel || concernLabel;

  return (
    <article
      className={`${styles.routePage} ${styles.stackPage} ${styles.productPage}`}
      aria-labelledby="me-product-title"
    >
      <div className={styles.productHero}>
        <div className={styles.productVisualLarge}>
          <SafeProductImage
            src={product.image}
            alt={`${product.brand} ${product.name}`}
            priority
          />
        </div>
        <div className={styles.productStory}>
          <p className={styles.eyebrow}>{product.brand}</p>
          <h1 id="me-product-title">{product.name}</h1>
          <p>{product.displayLine}</p>
          {hasPersonalContext ? (
            <p
              className={styles.productPersonalLine}
              aria-label="My product context"
            >
              {shelfLabel}
              {routineLabel ? ` · ${routineLabel}` : ""}
              {concernLabel
                ? `${shelfLabel || routineLabel ? " · " : ""}${concernLabel}`
                : ""}
            </p>
          ) : null}
          {reading ? (
            <div className={styles.marketReading} aria-label="Market reading">
              {reading.state === "priced" ? (
                <>
                  <p className={styles.marketPrice}>{reading.priceLabel}</p>
                  <p className={styles.marketStores}>
                    {reading.storeCount}{" "}
                    {reading.storeCount === 1
                      ? "observed store"
                      : "observed stores"}
                  </p>
                  {reading.freshnessLabel ? (
                    <p className={styles.marketFreshness}>
                      <time dateTime={reading.observedAt}>
                        {reading.freshnessLabel}
                      </time>
                    </p>
                  ) : null}
                </>
              ) : reading.state === "listing-only" ? (
                <>
                  <p className={styles.marketPrice}>
                    {reading.lastKnownPriceLabel ?? "Current price unavailable"}
                  </p>
                  <p className={styles.marketStores}>
                    {reading.listingCount}{" "}
                    {reading.listingCount === 1
                      ? "observed listing"
                      : "observed listings"}
                  </p>
                  {reading.freshnessLabel ? (
                    <p className={styles.marketFreshness}>
                      <time dateTime={reading.observedAt}>
                        {reading.freshnessLabel}
                      </time>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className={styles.marketPrice}>
                  No current Nigerian store evidence
                </p>
              )}
            </div>
          ) : null}
          <p className={styles.productUsage}>{product.usage}</p>
          <div className={styles.productActions}>
            <div
              className={styles.productEvidenceActions}
              role="group"
              aria-label="Product information"
            >
              <button
                className={styles.productEvidenceAction}
                type="button"
                aria-haspopup="dialog"
                aria-controls="me-product-evidence-sheet"
                aria-expanded={panelOpen && panelTab === "buy"}
                onClick={(event) => onOpenPanel("buy", event.currentTarget)}
              >
                <ShoppingBag size={16} aria-hidden="true" /> Find a store
              </button>
              <button
                className={`${styles.productEvidenceAction} ${styles.productEvidenceActionSecondary}`}
                type="button"
                aria-haspopup="dialog"
                aria-controls="me-product-evidence-sheet"
                aria-expanded={panelOpen && panelTab === "details"}
                onClick={(event) => onOpenPanel("details", event.currentTarget)}
              >
                <Info size={16} aria-hidden="true" /> Details
              </button>
            </div>
            {showShelfAction ? (
              <ShelfActionButton
                productSlug={product.slug}
                shelfItem={shelfItem}
                saved={false}
                placement="product"
                onAction={shelfAction}
                onSettled={onShelfMutation}
              />
            ) : null}
          </div>
          <div className={styles.productMeta} aria-label="Product details">
            <span>{product.size}</span>
            <span>{product.category}</span>
            <span>{product.step}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
