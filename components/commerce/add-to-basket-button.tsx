"use client";

import { Check, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHECKOUT_RETAILER_STORAGE_KEY } from "@/lib/commerce/basket";
import {
  chooseShoppingRetailer,
  retailerShoppingSlug,
  shoppingRetailerHref,
  type ShoppingRetailer,
} from "@/lib/commerce/shopping-session";
import { useBasket } from "./basket-provider";
import styles from "./procurement-actions.module.css";

export function AddToBasketButton({
  slug,
  productName,
  retailers,
  iconOnly = false,
  redirectToStore = true,
}: {
  slug: string;
  productName: string;
  retailers: readonly ShoppingRetailer[];
  iconOnly?: boolean;
  redirectToStore?: boolean;
}) {
  const basket = useBasket();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const inBasket = basket.items.some((item) => item.slug === slug);
  const storedRetailer = basket.ready
    ? localStorage.getItem(CHECKOUT_RETAILER_STORAGE_KEY)
    : null;
  const retailer = chooseShoppingRetailer(
    retailers,
    storedRetailer,
    basket.items.length > 0,
  );

  if (inBasket) {
    if (iconOnly) {
      return (
        <button
          className={`${styles.addButton} ${styles.iconButton}`}
          type="button"
          disabled
          aria-label={`${productName} is in your basket`}
        >
          <Check size={18} aria-hidden="true" />
        </button>
      );
    }
    return (
      <Link className={styles.basketLink} href="/basket">
        <Check size={18} aria-hidden="true" /> View basket
      </Link>
    );
  }

  if (limitReached && basket.notice === "product_limit_reached") {
    return (
      <Link
        className={iconOnly
          ? `${styles.basketLink} ${styles.iconButton}`
          : styles.basketLink}
        href="/basket"
        aria-label={iconOnly
          ? `Basket full. Review basket before adding ${productName}`
          : undefined}
      >
        <ShoppingBag size={18} aria-hidden="true" />
        {iconOnly ? null : "Basket full · Review"}
      </Link>
    );
  }

  if (!retailer && storedRetailer) {
    if (iconOnly) return null;
    return (
      <Link
        className={styles.basketLink}
        href={`/retailers/${retailerShoppingSlug(storedRetailer)}?shopping=1#store-products`}
      >
        Keep shopping at {storedRetailer}
      </Link>
    );
  }

  if (!retailer && basket.items.length > 0) {
    if (iconOnly) return null;
    return (
      <Link className={styles.basketLink} href="/basket">
        Review basket store
      </Link>
    );
  }

  if (!retailer) return null;

  return (
    <button
      className={`${styles.addButton} ${iconOnly ? styles.iconButton : ""}`}
      type="button"
      aria-label={iconOnly ? `Add ${productName} to basket` : undefined}
      data-added={added ? "true" : "false"}
      onClick={() => {
        const outcome = basket.add(slug);
        if (outcome === "product_limit_reached") {
          setLimitReached(true);
          return;
        }
        localStorage.setItem(CHECKOUT_RETAILER_STORAGE_KEY, retailer.name);
        setAdded(true);
        if (redirectToStore) {
          router.push(shoppingRetailerHref(retailer));
        }
      }}
    >
      {added ? (
        <Check size={18} aria-hidden="true" />
      ) : iconOnly ? (
        <Plus size={18} aria-hidden="true" />
      ) : (
        <ShoppingBag size={18} aria-hidden="true" />
      )}
      {iconOnly ? null : added ? "Opening store" : "Add to basket"}
    </button>
  );
}
