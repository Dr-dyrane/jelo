"use client";

import { Search, X, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/data/products";

export type PickerProduct = Pick<
  Product,
  "slug" | "brand" | "name" | "size" | "image"
>;

export function BundleProductPicker({
  allProducts,
  selectedSlugs,
  onAdd,
  onRemove,
}: {
  allProducts: PickerProduct[];
  selectedSlugs: string[];
  onAdd: (slug: string) => void;
  onRemove: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          !selectedSet.has(p.slug) &&
          (p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.slug.includes(q)),
      )
      .slice(0, 8);
  }, [query, allProducts, selectedSet]);

  return (
    <div className="bundle-picker">
      <div className="bundle-picker-search">
        <Search size={18} strokeWidth={1.9} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search products to add to your bundle…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search products"
        />
      </div>
      {results.length > 0 ? (
        <ul className="bundle-picker-results">
          {results.map((product) => (
            <li key={product.slug}>
              <button
                type="button"
                className="bundle-picker-item"
                onClick={() => {
                  onAdd(product.slug);
                  setQuery("");
                }}
              >
                <Plus size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>
                  {product.brand} {product.name}
                  <small>{product.size}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() ? (
        <p className="bundle-picker-no-results">No products found.</p>
      ) : null}
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
    <div className="bundle-selected">
      {products.map((product) => (
        <div key={product.slug} className="bundle-selected-chip">
          <span>
            {product.brand} {product.name}
            <small>{product.size}</small>
          </span>
          <button
            type="button"
            onClick={() => onRemove(product.slug)}
            aria-label={`Remove ${product.brand} ${product.name}`}
            className="bundle-selected-remove"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
