"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
  Store,
  Clock3,
  BadgeCheck,
} from "lucide-react";
import type { HandoffModel } from "@/lib/commerce/handoff-model";
import styles from "./handoff-view.module.css";

type Props = {
  model: HandoffModel;
};

export function HandoffView({ model }: Props) {
  const router = useRouter();
  const [continueClicked, setContinueClicked] = useState(false);
  const continueLinkRef = useRef<HTMLAnchorElement | null>(null);

  const offer = model.selectedOffer;

  // Focus the continue link on mount for keyboard users
  useEffect(() => {
    if (!offer) return;
    const frame = window.requestAnimationFrame(() => {
      continueLinkRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [offer]);

  // Escape returns to product page
  useEffect(() => {
    if (!offer) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        router.push(`/products/${model.productSlug}`);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router, model.productSlug, offer]);

  if (!offer) return null;

  function handleContinue() {
    setContinueClicked(true);
    // Navigation happens via the link href — no preventDefault
  }

  const continueHref = `/go/continue?product=${encodeURIComponent(model.productSlug)}&retailer=${encodeURIComponent(offer!.retailer)}`;
  const productHref = `/products/${model.productSlug}`;

  return (
    <main className={styles.main} aria-labelledby="handoff-title">
      <div className={styles.bridge}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Continuing to an external store</p>
          <h1 id="handoff-title" className={styles.title}>
            {offer.retailer}
          </h1>
          <p className={styles.subtitle}>
            {model.productBrand} {model.productName}
          </p>
        </div>

        <div className={styles.offerCard}>
          <div className={styles.offerMain}>
            <div className={styles.offerLeft}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={model.productImage}
                alt={`${model.productBrand} ${model.productName}`}
                className={styles.productImage}
                loading="eager"
              />
            </div>
            <div className={styles.offerRight}>
              <div className={styles.priceRow}>
                <span className={styles.price}>{offer.priceLabel}</span>
                {offer.isLowest && !offer.isSearchOnly ? (
                  <span className={styles.lowestBadge}>Lowest observed</span>
                ) : null}
              </div>
              <p className={styles.reason}>{model.reasonLabel}</p>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>Stock</dt>
                  <dd>{offer.stockLabel}</dd>
                </div>
                {offer.fulfilmentLabel ? (
                  <div className={styles.fact}>
                    <dt>Delivery</dt>
                    <dd>{offer.fulfilmentLabel}</dd>
                  </div>
                ) : null}
                {offer.observedAt ? (
                  <div className={styles.fact}>
                    <dt>Last checked</dt>
                    <dd>{offer.observedAt}</dd>
                  </div>
                ) : null}
                <div className={styles.fact}>
                  <dt>Trust</dt>
                  <dd>{offer.trust}/100</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Trust signals — only factual, never implied guarantees */}
          <div className={styles.signals}>
            {offer.listedByBrand ? (
              <span className={styles.signal}>
                <ShieldCheck size={14} aria-hidden="true" /> Listed by the brand
              </span>
            ) : null}
            {offer.sellerName ? (
              <span className={styles.signal}>
                Sold by {offer.sellerName}
                {offer.sellerScore ? ` · ${offer.sellerScore}%` : ""}
              </span>
            ) : null}
            {offer.checkSeller ? (
              <span className={`${styles.signal} ${styles.signalWarning}`}>
                <TriangleAlert size={14} aria-hidden="true" /> Check seller
              </span>
            ) : null}
            {offer.checkWithStore ? (
              <span className={`${styles.signal} ${styles.signalWarning}`}>
                <TriangleAlert size={14} aria-hidden="true" /> Check with store
              </span>
            ) : null}
            {offer.isSearchOnly ? (
              <span className={`${styles.signal} ${styles.signalWarning}`}>
                <TriangleAlert size={14} aria-hidden="true" /> Search link, not
                an exact listing
              </span>
            ) : null}
          </div>
        </div>

        {/* Disclosure — compact badge chips, Apple-style */}
        <div className={styles.disclosureChips}>
          <span className={styles.disclosureChip}>
            <Store size={13} strokeWidth={2} aria-hidden="true" />
            {offer.retailer}
          </span>
          <span className={styles.disclosureChip}>
            <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
            Prices may change
          </span>
          <span className={styles.disclosureChip}>
            <BadgeCheck size={13} strokeWidth={2} aria-hidden="true" />
            Listing ≠ genuine
          </span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <a
            ref={continueLinkRef}
            href={continueHref}
            className={styles.continueButton}
            onClick={handleContinue}
            aria-label={`Continue to ${offer.retailer} — external website`}
            rel="noopener nofollow"
          >
            {continueClicked ? (
              <>
                <Check size={18} aria-hidden="true" /> Continuing…
              </>
            ) : (
              <>
                <ExternalLink size={18} aria-hidden="true" /> Continue to{" "}
                {offer.retailer}
              </>
            )}
          </a>
          <Link href={productHref} className={styles.cancelButton}>
            <ChevronLeft size={16} aria-hidden="true" /> Back to product
          </Link>
        </div>

        {/* Alternative retailers */}
        {model.alternativeOffers.length > 0 ? (
          <div className={styles.alternatives}>
            <p className={styles.alternativesLabel}>Other checked stores</p>
            <ul className={styles.alternativeList}>
              {model.alternativeOffers.map((alt) => (
                <li key={alt.retailer}>
                  <Link
                    href={`/go?product=${encodeURIComponent(model.productSlug)}&retailer=${encodeURIComponent(alt.retailer)}`}
                    className={styles.alternativeRow}
                  >
                    <span className={styles.alternativeName}>
                      <strong>{alt.retailer}</strong>
                      <small>
                        {alt.priceLabel} · {alt.stockLabel}
                      </small>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  );
}
