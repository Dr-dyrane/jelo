import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/data/products";
import { findBuyTogetherSuggestions } from "@/lib/commerce/bundle-finder";

const formatNaira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export async function BuyTogetherSuggestions({
  product,
  allProducts,
}: {
  product: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">;
  allProducts: Pick<Product, "slug" | "name" | "brand" | "size" | "offers">[];
}) {
  const suggestions = findBuyTogetherSuggestions(
    product,
    allProducts,
    undefined,
    3,
  );

  if (suggestions.length === 0) return null;

  return (
    <section className="buy-together-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Save on delivery</p>
          <h2>Buy together at one store.</h2>
        </div>
        <Link
          className="text-link"
          href={`/bundle?products=${encodeURIComponent(product.slug)}`}
        >
          Bundle Finder <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="buy-together-list">
        {suggestions.map(
          ({ product: other, sharedRetailerCount, cheapestCombined }) => (
            <Link
              key={other.slug}
              className="buy-together-card"
              href={`/bundle?products=${encodeURIComponent(product.slug)},${encodeURIComponent(other.slug)}`}
            >
              <strong>
                {other.brand} {other.name}
              </strong>
              <small>{other.size}</small>
              <div className="buy-together-meta">
                <span className="buy-together-stores">
                  {sharedRetailerCount} store
                  {sharedRetailerCount === 1 ? "" : "s"}
                </span>
                <span className="buy-together-price">
                  from {formatNaira.format(cheapestCombined)}
                </span>
              </div>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
