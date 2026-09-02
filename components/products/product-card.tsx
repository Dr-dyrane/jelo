import Link from "next/link";
import { PackageSearch } from "lucide-react";
import type { Product } from "@/data/products";
import type { Offer } from "@/data/products";
import type { Market } from "@/data/prices";
import { MarketPrice } from "./market-price";
import { SafeProductImage } from "./safe-product-image";
import styles from "./product-card.module.css";

export type ProductCardProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  image?: string;
  imageUnavailableLabel?: string;
  offers?: Offer[];
  priceLabel?: string | null;
};

export type ProductCardContext = {
  onShelf?: boolean;
  inRoutine?: boolean;
  reviewedConcern?: boolean;
  retailerNames?: readonly string[];
};

export function ProductCard({
  product,
  market = "NG",
  href,
  context,
  footer,
  density = "default",
}: {
  product: ProductCardProduct;
  market?: Market;
  href?: string;
  context?: ProductCardContext;
  footer?: React.ReactNode;
  density?: "default" | "compact";
}) {
  const linkHref = href ?? `/products/${product.slug}`;
  const priceLabel = product.offers ? (
    <MarketPrice offers={product.offers} market={market} />
  ) : (
    (product.priceLabel ?? "")
  );
  const contextBadges = context
    ? [
        context.onShelf ? <span key="shelf">On your Shelf</span> : null,
        context.inRoutine ? <span key="routine">In your routine</span> : null,
        context.reviewedConcern ? (
          <span key="concern">Reviewed concern support</span>
        ) : null,
        ...(context.retailerNames ?? []).map((name) => (
          <span key={`retailer-${name}`}>{name}</span>
        )),
      ].filter(Boolean)
    : [];
  const densityClass = density === "compact" ? styles.compact : "";
  const missingVisual = (
    <div
      className={styles.missingVisual}
      role="img"
      aria-label={product.imageUnavailableLabel ?? "Product image unavailable"}
    >
      <PackageSearch size={34} aria-hidden="true" />
      <small>{product.imageUnavailableLabel ?? "Image unavailable"}</small>
    </div>
  );
  return (
    <article
      className={`${styles.card} ${densityClass} product-card`}
      data-image={product.image ? "ready" : "missing"}
    >
      <Link
        className={styles.link}
        href={linkHref}
        aria-label={`${product.brand} ${product.name}, ${product.size}`}
      >
        <div className={`${styles.visual} product-visual`}>
          {product.image ? (
            <SafeProductImage
              src={product.image}
              alt={`${product.brand} ${product.name}`}
              fallback={
                product.imageUnavailableLabel !== undefined
                  ? missingVisual
                  : undefined
              }
            />
          ) : (
            missingVisual
          )}
        </div>
        <div className={`${styles.copy} product-copy`}>
          <p className="eyebrow">{product.brand}</p>
          <h3>{product.name}</h3>
          <div className={styles.meta}>
            <span>{product.size}</span>
            <span>{priceLabel}</span>
          </div>
          {contextBadges.length ? (
            <div className={styles.context}>{contextBadges}</div>
          ) : null}
        </div>
      </Link>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </article>
  );
}

export function ProductCardFromProduct({
  product,
  market = "NG",
}: {
  product: Product;
  market?: Market;
}) {
  return <ProductCard product={product} market={market} />;
}
