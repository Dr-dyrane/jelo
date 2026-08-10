"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Product } from "@/data/products";
import type { BundleFinderResult } from "@/lib/commerce/bundle-finder";
import {
  BundleProductPicker,
  BundleSelectedProducts,
  type PickerProduct,
} from "./bundle-product-picker";
import { BundleResults, BundleEmptyState } from "./bundle-results";

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

  const pickerProducts = useMemo<PickerProduct[]>(
    () =>
      allProducts.map((p) => ({
        slug: p.slug,
        brand: p.brand,
        name: p.name,
        size: p.size,
        image: p.image,
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
      router.push(`/bundle${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [router, searchParams],
  );

  const handleAdd = useCallback(
    (slug: string) => {
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

  return (
    <div className="bundle-finder">
      <div className="bundle-finder-picker-section">
        <BundleProductPicker
          allProducts={pickerProducts}
          selectedSlugs={initialSlugs}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
        <BundleSelectedProducts
          products={selectedProducts}
          onRemove={handleRemove}
        />
      </div>

      {hasEnoughProducts ? (
        initialResult.bundles.length > 0 ? (
          <>
            <p className="bundle-results-count">
              {initialResult.bundles.length} store
              {initialResult.bundles.length === 1 ? "" : "s"} carry all{" "}
              {initialSlugs.length} products
            </p>
            <BundleResults bundles={initialResult.bundles} />
          </>
        ) : (
          <BundleEmptyState productSlugs={initialSlugs} />
        )
      ) : (
        <div className="bundle-finder-hint">
          <p>
            Add at least 2 products to find stores where you can buy them
            together in one shipment.
          </p>
        </div>
      )}
    </div>
  );
}
