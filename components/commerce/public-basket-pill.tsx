"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { useBasket } from "@/components/commerce/basket-provider";
import type { BasketPreviewProduct } from "@/lib/commerce/basket-preview";
import { buildBasketPreview } from "@/lib/commerce/basket-preview";
import { BASKET_MAX_PRODUCTS } from "@/lib/commerce/basket";
import styles from "./public-basket-pill.module.css";

const hiddenRoutes = ["/basket", "/checkout", "/order", "/sign-in"];

function isBasketFlow(pathname: string) {
  return hiddenRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isProductDetail(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "products";
}

export function PublicBasketPill({
  products,
  surface = "public",
}: {
  products: readonly BasketPreviewProduct[];
  surface?: "public" | "workspace";
}) {
  const pathname = usePathname();
  const basket = useBasket();
  const preview = useMemo(
    () => buildBasketPreview(basket.items, products),
    [basket.items, products],
  );

  if (
    !basket.ready ||
    basket.totalQuantity === 0 ||
    isBasketFlow(pathname) ||
    isProductDetail(pathname)
  ) {
    return null;
  }

  const itemLabel = basket.totalQuantity === 1 ? "item" : "items";
  const productSummary = preview
    .map((product) => `${product.brand} ${product.name}, ${product.quantity}`)
    .join("; ");
  const productLimitReached = basket.notice === "product_limit_reached";
  const basketLabel = productLimitReached
    ? `Basket full. Your basket holds up to ${BASKET_MAX_PRODUCTS} products. View basket to replace one.`
    : `View basket, ${basket.totalQuantity} ${itemLabel}. ${productSummary}`;

  return (
    <aside
      className={styles.positioner}
      data-surface={surface}
      aria-label="Current basket"
    >
      <Link className={styles.pill} href="/basket" aria-label={basketLabel}>
        <span className={styles.avatars} aria-hidden="true">
          {preview.map((product) => (
            <span className={styles.avatar} key={product.slug}>
              <SafeProductImage src={product.image} alt="" />
              <span className={styles.quantity}>{product.quantity}</span>
            </span>
          ))}
        </span>
        <span
          className={styles.copy}
          role={productLimitReached ? "status" : undefined}
          aria-live={productLimitReached ? "polite" : undefined}
          aria-atomic={productLimitReached ? "true" : undefined}
        >
          <strong>{productLimitReached ? "Basket full" : "Basket"}</strong>
          <small>
            {productLimitReached
              ? `Review ${BASKET_MAX_PRODUCTS} products`
              : `${basket.totalQuantity} ${itemLabel}`}
          </small>
        </span>
        <span className={styles.icon} aria-hidden="true">
          <ShoppingBag size={17} strokeWidth={1.8} />
        </span>
      </Link>
    </aside>
  );
}
