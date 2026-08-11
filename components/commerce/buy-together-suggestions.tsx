import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/data/products";
import { findBuyTogetherSuggestions } from "@/lib/commerce/bundle-finder";
import { ProductCard } from "@/components/products/product-card";
import styles from "./buy-together-suggestions.module.css";

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
  allProducts: Pick<
    Product,
    "slug" | "name" | "brand" | "size" | "image" | "offers"
  >[];
}) {
  const productsBySlug = new Map(
    allProducts.map((catalogueProduct) => [
      catalogueProduct.slug,
      catalogueProduct,
    ]),
  );
  const suggestions = findBuyTogetherSuggestions(
    product,
    allProducts,
    undefined,
    3,
  );

  if (suggestions.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="buy-together-title">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">One basket</p>
          <h2 id="buy-together-title">Buy together.</h2>
          <p className={styles.lead}>
            Each pair has an exact Nigerian retailer in common. Product totals
            exclude delivery.
          </p>
        </div>
        <Link
          className={styles.finderLink}
          href={`/bundle?products=${encodeURIComponent(product.slug)}`}
        >
          Build your own <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.rail}>
        {suggestions.map(
          ({ product: other, sharedRetailerCount, cheapestCombined }) => {
            const catalogueProduct = productsBySlug.get(other.slug);
            if (!catalogueProduct) return null;

            return (
              <ProductCard
                key={other.slug}
                product={{
                  slug: catalogueProduct.slug,
                  brand: catalogueProduct.brand,
                  name: catalogueProduct.name,
                  size: catalogueProduct.size,
                  image: catalogueProduct.image,
                  priceLabel: `From ${formatNaira.format(cheapestCombined)} together`,
                }}
                href={`/bundle?products=${encodeURIComponent(product.slug)},${encodeURIComponent(other.slug)}`}
                footer={
                  <span className={styles.storeCount}>
                    {sharedRetailerCount} shared store
                    {sharedRetailerCount === 1 ? "" : "s"}
                  </span>
                }
              />
            );
          },
        )}
      </div>
    </section>
  );
}
