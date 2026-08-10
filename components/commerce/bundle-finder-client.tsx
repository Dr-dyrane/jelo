"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import type { Product } from "@/data/products";
import type { BundleFinderResult } from "@/lib/commerce/bundle-finder";
import {
  BundleProductPicker,
  BundleSelectedProducts,
  type PickerProduct,
} from "./bundle-product-picker";
import { BundleResults, BundleEmptyState } from "./bundle-results";
import styles from "./bundle-finder.module.css";

type FullProduct = Pick<
  Product,
  "slug" | "name" | "brand" | "size" | "image" | "offers"
>;

export function BundleFinderClient({
  allProducts,
  initialResult,
  initialSlugs,
}: {
  allProducts: FullProduct[];
  initialResult: BundleFinderResult;
  initialSlugs: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pickerProducts = useMemo<PickerProduct[]>(
    () =>
      allProducts.map((p) => ({
        slug: p.slug,
        brand: p.brand,
        name: p.name,
        size: p.size,
        image: p.image,
        offers: p.offers,
      })),
    [allProducts],
  );

  const selectedProducts = useMemo(
    () => allProducts.filter((p) => initialSlugs.includes(p.slug)),
    [allProducts, initialSlugs],
  );

  const updateUrl = useCallback(
    (slugs: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slugs.length > 0) {
        params.set("products", slugs.join(","));
      } else {
        params.delete("products");
      }
      startTransition(() => {
        router.push(
          `/bundle${params.toString() ? `?${params.toString()}` : ""}`,
          { scroll: false },
        );
      });
    },
    [router, searchParams],
  );

  const handleAdd = useCallback(
    (slug: string) => {
      if (initialSlugs.includes(slug) || initialSlugs.length >= 4) return;
      const next = [...initialSlugs, slug];
      updateUrl(next);
    },
    [initialSlugs, updateUrl],
  );

  const handleRemove = useCallback(
    (slug: string) => {
      const next = initialSlugs.filter((s) => s !== slug);
      updateUrl(next);
    },
    [initialSlugs, updateUrl],
  );

  const hasEnoughProducts = initialSlugs.length >= 2;
  const selectionStatus = isPending
    ? "Updating your bundle…"
    : initialSlugs.length === 0
      ? "Choose at least 2 products."
      : initialSlugs.length === 1
        ? "1 selected · add 1 more."
        : initialSlugs.length === 4
          ? "4 selected · maximum reached."
          : `${initialSlugs.length} selected · comparing exact listings.`;

  return (
    <div className={styles.finder} aria-busy={isPending}>
      <div className={styles.pickerSection}>
        <BundleProductPicker
          allProducts={pickerProducts}
          selectedSlugs={initialSlugs}
          onAdd={handleAdd}
        />
        <div className={styles.selectionBar}>
          <p role="status" aria-live="polite">
            {selectionStatus}
          </p>
          {initialSlugs.length > 0 ? (
            <button type="button" onClick={() => updateUrl([])}>
              Clear selection
            </button>
          ) : null}
        </div>
        <BundleSelectedProducts
          products={selectedProducts}
          onRemove={handleRemove}
        />
      </div>

      {hasEnoughProducts ? (
        initialResult.bundles.length > 0 ? (
          <>
            <div className={styles.resultsHeading}>
              <div>
                <p className="eyebrow">Retailer matches</p>
                <h2>
                  {initialResult.bundles.length} retailer
                  {initialResult.bundles.length === 1 ? "" : "s"} list every
                  item.
                </h2>
              </div>
              <p>Ranked by the listed product total, then retailer trust.</p>
            </div>
            <BundleResults
              bundles={initialResult.bundles}
              products={pickerProducts}
            />
          </>
        ) : (
          <BundleEmptyState productCount={initialSlugs.length} />
        )
      ) : (
        <div className={styles.hint}>
          <p>
            Add {initialSlugs.length === 0 ? "2 products" : "1 more product"} to
            compare retailers that list every item.
          </p>
        </div>
      )}
    </div>
  );
}
