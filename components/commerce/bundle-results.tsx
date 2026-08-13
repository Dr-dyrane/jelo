"use client";

import { ArrowRight, ArrowUpRight, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import type { BundleOffer } from "@/lib/commerce/bundle-finder";
import { ProductCard } from "@/components/products/product-card";
import type { PickerProduct } from "./bundle-product-picker";
import styles from "./bundle-finder.module.css";
import { useBasket } from "./basket-provider";
import { CHECKOUT_RETAILER_STORAGE_KEY } from "@/lib/commerce/basket";

const formatNaira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function BundleResults({
  bundles,
  products,
}: {
  bundles: BundleOffer[];
  products: PickerProduct[];
}) {
  if (bundles.length === 0) return null;

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );

  return (
    <div className={styles.results}>
      {bundles.map((bundle, index) => (
        <BundleRow
          key={bundle.retailer}
          bundle={bundle}
          rank={index + 1}
          productsBySlug={productsBySlug}
        />
      ))}
      <div className={styles.disclaimers} aria-label="Price notes">
        <span>Prices may change</span>
        <span>Delivery extra</span>
        <span>Listing ≠ genuine</span>
      </div>
    </div>
  );
}

function BundleRow({
  bundle,
  rank,
  productsBySlug,
}: {
  bundle: BundleOffer;
  rank: number;
  productsBySlug: Map<string, PickerProduct>;
}) {
  const isLowest = rank === 1;
  const basket = useBasket();
  const router = useRouter();

  return (
    <article className={styles.resultCard}>
      <header className={styles.resultHeader}>
        <span className={styles.rank}>{String(rank).padStart(2, "0")}</span>
        <div className={styles.retailerName}>
          <p className="eyebrow">One retailer</p>
          <h3>{bundle.retailer}</h3>
          <div className={styles.resultSignals}>
            {isLowest ? <span>Lowest listed product total</span> : null}
            <span>
              {bundle.allInStock
                ? "All listed in stock"
                : "Some items unavailable"}
            </span>
          </div>
        </div>
        <div className={styles.total}>
          <span>Product total</span>
          <strong>{formatNaira.format(bundle.combinedTotal)}</strong>
        </div>
      </header>

      <div className={`product-grid ${styles.resultProducts}`}>
        {bundle.offers.map((offer) => {
          const product = productsBySlug.get(offer.productSlug);
          if (!product) return null;
          return (
            <ProductCard
              key={offer.productSlug}
              product={{
                slug: product.slug,
                brand: product.brand,
                name: product.name,
                size: product.size,
                image: product.image,
                priceLabel: formatNaira.format(offer.priceNgn),
              }}
              density="compact"
              href={`/go?product=${encodeURIComponent(offer.productSlug)}&retailer=${encodeURIComponent(offer.retailer)}`}
              context={{ retailerNames: [bundle.retailer] }}
              footer={
                <span className={styles.openStore} aria-hidden="true">
                  <ArrowUpRight size={19} strokeWidth={1.9} />
                </span>
              }
            />
          );
        })}
      </div>
      <footer className={styles.procurementFooter}>
        <p><ShoppingBag size={17} aria-hidden="true" /> Request this exact basket from one retailer.</p>
        <button type="button" onClick={() => {
          basket.replace(bundle.offers.map(offer => ({ slug: offer.productSlug, quantity: 1 })));
          localStorage.setItem(CHECKOUT_RETAILER_STORAGE_KEY, bundle.retailer);
          router.push('/checkout');
        }}>Checkout with {bundle.retailer} <ArrowRight size={17} aria-hidden="true" /></button>
      </footer>
    </article>
  );
}

export function BundleEmptyState({ productCount }: { productCount: number }) {
  return (
    <div className={styles.empty}>
      <p className="eyebrow">No one-retailer match</p>
      <h2>These {productCount} products do not meet at one retailer yet.</h2>
      <p>
        Remove one product or try another. JeloCare only shows exact listings.
      </p>
    </div>
  );
}
