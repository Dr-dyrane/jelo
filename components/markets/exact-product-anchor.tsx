import { PackageCheck } from "lucide-react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import type { MarketFixtureProduct } from "@/lib/markets/fixture";
import styles from "./market-finder.module.css";

export function ExactProductAnchor({
  product,
}: {
  product: MarketFixtureProduct;
}) {
  return (
    <aside
      className={styles.productAnchor}
      aria-labelledby="market-exact-product"
    >
      <div className={styles.anchorHeading}>
        <PackageCheck size={18} aria-hidden="true" />
        <span>Exact product anchor</span>
      </div>

      <div className={styles.productIdentity}>
        {product.image ? (
          <span className={styles.packshotStage}>
            <SafeProductImage
              src={product.image}
              alt={`${product.brand} ${product.name}, ${product.size}`}
              className={styles.packshot}
              priority
            />
          </span>
        ) : (
          <span
            className={styles.packshotMissing}
            role="img"
            aria-label="Reviewed product packshot not available in this fixture"
          >
            <strong>{product.brand}</strong>
            <small>Packshot pending</small>
          </span>
        )}

        <span className={styles.productCopy}>
          <small>{product.brand}</small>
          <strong id="market-exact-product">{product.name}</strong>
          <span>{product.size}</span>
        </span>
      </div>

      <p>{product.identityNote}</p>
      <span className={styles.fixtureChip}>
        Research fixture · not live guidance
      </span>
    </aside>
  );
}
