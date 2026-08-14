"use client";

import Link from "next/link";
import { ArrowRight, ShelvingUnit } from "lucide-react";
import { AddToBasketButton } from "@/components/commerce/add-to-basket-button";
import { PrivateProductRequestShelf } from "@/components/me/product-requests/product-request-experience";
import type { ShelfActionHandler } from "@/components/me/shelf/me-shelf-state";
import { ME_PORTAL_SURFACES } from "@/components/me/shell/me-shell-model";
import { ProductCard } from "@/components/products/product-card";
import type { CustomerProductRequestPresentationViewModel } from "@/lib/customer/product-request-model";
import type { CustomerPortalViewModel } from "@/lib/customer/portal-model";
import type { CustomerShelfActionResult } from "@/lib/customer/shelf-service";
import { retailerShoppingSlug } from "@/lib/commerce/shopping-session";
import {
  memberProductHref,
  UnavailableShelfCard,
} from "@/components/me/home/shared-views";
import styles from "./shelf-view.module.css";

export function ShelfView({
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
  const shelfReady = viewModel.shelfState.status === "ready";
  const savedCount = shelfReady ? viewModel.shelf.length : 0;

  return (
    <section className={styles.page} aria-labelledby="me-shelf-title">
      <header className={styles.heading}>
        <div>
          <p>{surface.eyebrow}</p>
          <h1 id="me-shelf-title">{surface.title}</h1>
        </div>
        <p className={styles.reading} role="status">
          {shelfReady
            ? `${savedCount} exact ${savedCount === 1 ? "product" : "products"}, saved privately`
            : "Shelf unavailable"}
        </p>
      </header>

      {viewModel.shelfState.status === "unavailable" ? (
        <div className={styles.empty} role="status">
          <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h2>Your Shelf is resting.</h2>
            <p>{viewModel.shelfState.message}</p>
          </div>
          <Link href="/me/shelf">Try again</Link>
        </div>
      ) : viewModel.shelf.length ? (
        <div className={`product-grid ${styles.collection}`}>
          {viewModel.shelf.map((item) =>
            item.product ? (
              <ProductCard
                key={item.identityVersionId}
                product={item.product}
                href={memberProductHref(item.product, "shelf")}
                footer={
                  item.product.freshExactRetailerNames.length ? (
                    <AddToBasketButton
                      slug={item.product.slug}
                      productName={`${item.product.brand} ${item.product.name}`}
                      retailers={item.product.freshExactRetailerNames.map(
                        (name) => ({
                          name,
                          slug: retailerShoppingSlug(name),
                        }),
                      )}
                      iconOnly
                    />
                  ) : null
                }
              />
            ) : (
              <UnavailableShelfCard
                key={item.identityVersionId}
                item={item}
                shelfAction={shelfAction}
                onSettled={onShelfMutation}
              />
            ),
          )}
        </div>
      ) : (
        <div className={styles.empty}>
          <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h2>Your Shelf is open.</h2>
            <p>Save an exact product when you want to find it again.</p>
          </div>
          <Link href="/me/explore">
            Explore products <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}

      {shelfReady ? (
        <div className={styles.requests}>
          <PrivateProductRequestShelf
            synthetic={viewModel.account.synthetic}
            initialRequests={productRequestPresentation?.requests}
            mutationOutcome={productRequestOutcome}
          />
        </div>
      ) : null}
    </section>
  );
}
