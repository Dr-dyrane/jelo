import Link from "next/link";
import { PackageCheck, RefreshCw } from "lucide-react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import type { MarketSurfaceProduct } from "@/lib/markets/presentation";
import styles from "./market-finder.module.css";

export function ExactProductAnchor({
  product,
  changeHref = "/markets#exact-products-title",
}: {
  product: MarketSurfaceProduct;
  changeHref?: string;
}) {
  const pendingPackshot = (
    <div
      className={styles.packshotMissing}
      role="img"
      aria-label="Reviewed product packshot unavailable"
    >
      <PackageCheck size={30} aria-hidden="true" />
      <small>Packshot pending</small>
    </div>
  );

  return (
    <aside
      className={styles.productAnchor}
      aria-labelledby="market-exact-product"
    >
      <div className={styles.productAnchorHeader}>
        <span>
          <PackageCheck size={16} aria-hidden="true" />
          Selected product
        </span>
        <Link
          className={styles.changeProduct}
          href={changeHref}
          aria-label="Change product"
        >
          <RefreshCw size={15} aria-hidden="true" />
          <span>Change</span>
        </Link>
      </div>

      <div className={`${styles.packshotStage} product-visual`}>
        {product.image ? (
          <SafeProductImage
            src={product.image}
            alt={`${product.brand} ${product.name}, ${product.size}`}
            className={styles.packshot}
            priority
            fallback={pendingPackshot}
          />
        ) : (
          pendingPackshot
        )}
      </div>

      <span className={styles.productCopy}>
        <small>{product.brand}</small>
        <strong id="market-exact-product">{product.name}</strong>
        <span>{product.size}</span>
      </span>
    </aside>
  );
}
