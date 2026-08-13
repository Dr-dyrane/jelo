"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { useBasket } from "@/components/commerce/basket-provider";
import type { BasketPreviewProduct } from "@/lib/commerce/basket-preview";
import { buildBasketPreview } from "@/lib/commerce/basket-preview";
import styles from "./public-basket-pill.module.css";

const hiddenRoutes = ["/basket", "/checkout", "/order", "/sign-in"];

function isBasketFlow(pathname: string) {
  return hiddenRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function PublicBasketPill({
  products,
}: {
  products: readonly BasketPreviewProduct[];
}) {
  const pathname = usePathname();
  const basket = useBasket();
  const preview = useMemo(
    () => buildBasketPreview(basket.items, products),
    [basket.items, products],
  );

  if (!basket.ready || basket.totalQuantity === 0 || isBasketFlow(pathname)) {
    return null;
  }

  const itemLabel = basket.totalQuantity === 1 ? "item" : "items";
  const productSummary = preview
    .map((product) => `${product.brand} ${product.name}, ${product.quantity}`)
    .join("; ");

  return (
    <aside className={styles.positioner} aria-label="Current basket">
      <Link
        className={styles.pill}
        href="/basket"
        aria-label={`View basket, ${basket.totalQuantity} ${itemLabel}. ${productSummary}`}
      >
        <span className={styles.avatars} aria-hidden="true">
          {preview.map((product) => (
            <span className={styles.avatar} key={product.slug}>
              <SafeProductImage src={product.image} alt="" />
              <span className={styles.quantity}>{product.quantity}</span>
            </span>
          ))}
        </span>
        <span className={styles.copy}>
          <strong>Basket</strong>
          <small>
            {basket.totalQuantity} {itemLabel}
          </small>
        </span>
        <span className={styles.icon} aria-hidden="true">
          <ShoppingBag size={17} strokeWidth={1.8} />
        </span>
      </Link>
    </aside>
  );
}
