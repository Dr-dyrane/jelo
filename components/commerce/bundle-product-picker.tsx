"use client";

import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { rankCatalogueSearchRecords } from "@/lib/catalogue/catalogue-search-index";
import { ProductCard } from "@/components/products/product-card";
import styles from "./bundle-finder.module.css";

export type PickerProduct = Pick<
  Product,
  "slug" | "brand" | "name" | "size" | "image" | "offers"
>;

export function BundleProductPicker({
  allProducts,
  selectedSlugs,
  onAdd,
}: {
  allProducts: PickerProduct[];
  selectedSlugs: string[];
  onAdd: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const availableProducts = useMemo(
    () => allProducts.filter((product) => !selectedSet.has(product.slug)),
    [allProducts, selectedSet],
  );

  const productsByHref = useMemo(
    () =>
      new Map(
        availableProducts.map((product) => [
          `/products/${product.slug}`,
          product,
        ]),
      ),
    [availableProducts],
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      const withObservedOffers = availableProducts.filter((product) =>
        product.offers.some((offer) => offer.priceNgn != null),
      );
      return (
        withObservedOffers.length >= 6 ? withObservedOffers : availableProducts
      ).slice(0, 6);
    }

    return rankCatalogueSearchRecords(
      availableProducts.map((product) => ({
        source: "reviewed" as const,
        brand: product.brand,
        name: product.name,
        size: product.size,
        href: `/products/${product.slug}`,
      })),
      query,
      8,
    )
      .map((record) => productsByHref.get(record.href))
      .filter((product): product is PickerProduct => product != null);
  }, [availableProducts, productsByHref, query]);

  const isFull = selectedSlugs.length >= 4;
  const resultsLabel = query.trim()
    ? `${results.length} ${results.length === 1 ? "match" : "matches"}`
    : "Start with a product";

  return (
    <div className={styles.picker}>
      <p className={styles.stageLabel}>
        <span>01</span> Products
      </p>
      <label className={styles.searchLabel} htmlFor="bundle-product-search">
        Find a product
      </label>
      <div className={styles.searchField}>
        <Search size={20} strokeWidth={1.8} aria-hidden="true" />
        <input
          id="bundle-product-search"
          type="search"
          placeholder="Search by product or brand"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          aria-describedby="bundle-search-status"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear product search"
            className={styles.clearQuery}
          >
            <X size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className={styles.pickerHeading}>
        <p id="bundle-search-status" role="status" aria-live="polite">
          {resultsLabel}
        </p>
        {isFull ? <span>Remove one to add another</span> : null}
      </div>

      {results.length > 0 ? (
        <div className={`product-rail ${styles.productRail}`}>
          {results.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              density="compact"
              footer={
                <button
                  type="button"
                  className={styles.cardAction}
                  onClick={() => onAdd(product.slug)}
                  disabled={isFull}
                  aria-label={`Add ${product.brand} ${product.name} to bundle`}
                >
                  <Plus size={19} strokeWidth={1.9} aria-hidden="true" />
                </button>
              }
            />
          ))}
        </div>
      ) : (
        <div className={styles.noResults}>
          <p>No matching product yet.</p>
          <button type="button" onClick={() => setQuery("")}>
            Browse starter products
          </button>
        </div>
      )}
    </div>
  );
}

export function BundleSelectedProducts({
  products,
  onRemove,
}: {
  products: PickerProduct[];
  onRemove: (slug: string) => void;
}) {
  if (products.length === 0) return null;

  return (
    <section
      className={styles.selected}
      aria-labelledby="bundle-selected-title"
    >
      <div className={styles.selectedHeading}>
        <p className="eyebrow">Your bundle</p>
        <h2 id="bundle-selected-title">Selected products.</h2>
      </div>
      <div className={`product-rail ${styles.productRail}`}>
        {products.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            density="compact"
            footer={
              <button
                type="button"
                className={`${styles.cardAction} ${styles.removeAction}`}
                onClick={() => onRemove(product.slug)}
                aria-label={`Remove ${product.brand} ${product.name} from bundle`}
              >
                <X size={19} strokeWidth={1.9} aria-hidden="true" />
              </button>
            }
          />
        ))}
      </div>
    </section>
  );
}
