"use client";

import { ArrowUpRight, Package, Truck } from "lucide-react";
import type { BundleOffer } from "@/lib/commerce/bundle-finder";

const formatNaira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function BundleResults({ bundles }: { bundles: BundleOffer[] }) {
  if (bundles.length === 0) return null;

  return (
    <div className="bundle-results">
      {bundles.map((bundle, index) => (
        <BundleRow key={bundle.retailer} bundle={bundle} rank={index + 1} />
      ))}
    </div>
  );
}

function BundleRow({ bundle, rank }: { bundle: BundleOffer; rank: number }) {
  const isCheapest = rank === 1;
  return (
    <div
      className={`bundle-row ${isCheapest ? "bundle-row-best" : ""} ${!bundle.allInStock ? "bundle-row-partial" : ""}`}
    >
      <div className="bundle-row-header">
        <span className="bundle-rank">{String(rank).padStart(2, "0")}</span>
        <div className="bundle-store-info">
          <strong>{bundle.retailer}</strong>
          {isCheapest ? (
            <small className="bundle-badge">Cheapest combined</small>
          ) : null}
          {!bundle.allInStock ? (
            <small className="bundle-badge bundle-badge-warn">
              Some items low/out of stock
            </small>
          ) : (
            <small className="bundle-badge bundle-badge-ok">
              <Truck size={12} strokeWidth={1.9} aria-hidden="true" /> One
              shipment
            </small>
          )}
        </div>
        <div className="bundle-total">
          <span className="bundle-total-label">Combined</span>
          <strong className="bundle-total-value">
            {formatNaira.format(bundle.combinedTotal)}
          </strong>
        </div>
      </div>
      <div className="bundle-products">
        {bundle.offers.map((offer) => (
          <a
            key={offer.productSlug}
            className="bundle-product-link"
            href={`/go?product=${encodeURIComponent(offer.productSlug)}&retailer=${encodeURIComponent(offer.retailer)}`}
          >
            <span className="bundle-product-name">
              {offer.productBrand} {offer.productName}
              <small>{offer.productSize}</small>
            </span>
            <span className="bundle-product-price">
              {formatNaira.format(offer.priceNgn)}
              <ArrowUpRight size={14} strokeWidth={1.9} aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function BundleEmptyState({ productSlugs }: { productSlugs: string[] }) {
  return (
    <div className="bundle-empty">
      <Package size={32} strokeWidth={1.5} aria-hidden="true" />
      <p>
        No single store carries all {productSlugs.length} products together.
      </p>
      <p className="bundle-empty-hint">
        Try removing a product or choosing different ones — the more products
        you add, the harder it is to find one store that stocks them all.
      </p>
    </div>
  );
}
