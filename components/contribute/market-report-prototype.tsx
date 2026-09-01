"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  LockKeyhole,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Store,
} from "lucide-react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import {
  MARKET_REPORT_OUTCOMES,
  type MarketReportOutcomeId,
} from "@/lib/markets/feedback";
import styles from "./market-report-prototype.module.css";

const OUTCOME_DETAILS: Record<MarketReportOutcomeId, string> = {
  found_bought: "The selected pack was available at this shop.",
  shop_exists_no_stock:
    "The shop was there, but this exact product was unavailable.",
  location_wrong: "The shop name, unit or final-leg direction did not match.",
  shop_closed: "The shop appears to have stopped trading at this location.",
};

type ProductContext = {
  brand: string;
  name: string;
  size: string;
  image?: string;
  identityNote: string;
};

type MarketContext = {
  name: string;
  location: string;
};

type ShopContext = {
  name: string;
  locationLabel: string;
  stateLabel: string;
};

export function MarketReportPrototype({
  product,
  market,
  shop,
  returnHref,
}: {
  product: ProductContext;
  market: MarketContext;
  shop: ShopContext;
  returnHref: string;
}) {
  const [outcome, setOutcome] = useState<MarketReportOutcomeId | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const selectedOutcome = MARKET_REPORT_OUTCOMES.find(
    (option) => option.id === outcome,
  );

  function chooseOutcome(nextOutcome: MarketReportOutcomeId) {
    setOutcome(nextOutcome);
    setReviewed(false);
  }

  function previewReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outcome) setReviewed(true);
  }

  return (
    <main className={styles.page} data-market-report-prototype="true">
      <div className={styles.shell}>
        <div className={styles.previewNotice} role="note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <strong>Development preview.</strong> Nothing selected here is saved
            or sent.
          </span>
        </div>

        <Link className={styles.backLink} href={returnHref}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to shop record
        </Link>

        <header className={styles.header}>
          <p>Contribute · market update</p>
          <h1>Tell us what you found.</h1>
          <span>
            One specific outcome can help us investigate this market record. A
            report never changes public guidance by itself.
          </span>
        </header>

        <div className={styles.layout}>
          <aside
            className={styles.context}
            aria-labelledby="market-report-context"
          >
            <div className={styles.contextHeading}>
              <div>
                <p>Locked report context</p>
                <h2 id="market-report-context">The exact visit</h2>
              </div>
              <LockKeyhole size={20} aria-hidden="true" />
            </div>

            <div className={styles.productContext}>
              <span className={styles.packshotStage}>
                {product.image ? (
                  <SafeProductImage
                    src={product.image}
                    alt={`${product.brand} ${product.name}, ${product.size}`}
                    className={styles.packshot}
                    priority
                  />
                ) : (
                  <PackageCheck
                    size={30}
                    aria-label="Product packshot unavailable"
                  />
                )}
              </span>
              <span className={styles.productCopy}>
                <small>{product.brand}</small>
                <strong>{product.name}</strong>
                <span>{product.size}</span>
              </span>
            </div>

            <p className={styles.identityNote}>{product.identityNote}</p>

            <dl className={styles.placeContext}>
              <div>
                <dt>
                  <MapPin size={16} aria-hidden="true" /> Market
                </dt>
                <dd>
                  {market.name}
                  <span>{market.location}</span>
                </dd>
              </div>
              <div>
                <dt>
                  <Store size={16} aria-hidden="true" /> Shop record
                </dt>
                <dd>
                  {shop.name}
                  <span>{shop.locationLabel}</span>
                </dd>
              </div>
            </dl>

            <p className={styles.currentState}>{shop.stateLabel}</p>
          </aside>

          <form
            className={styles.report}
            id="contribution-form"
            onSubmit={previewReport}
          >
            <div className={styles.reportHeading}>
              <p>Step 1 of 1</p>
              <h2>What happened at this shop?</h2>
              <span>
                Choose the closest factual outcome. Product and place cannot be
                changed in this report.
              </span>
            </div>

            <div
              className={styles.outcomes}
              role="radiogroup"
              aria-label="Market visit outcome"
            >
              {MARKET_REPORT_OUTCOMES.map((option) => {
                const selected = outcome === option.id;
                return (
                  <label
                    className={styles.outcome}
                    data-selected={selected ? "true" : "false"}
                    key={option.id}
                  >
                    <input
                      className={styles.outcomeInput}
                      type="radio"
                      name="market-report-outcome"
                      value={option.id}
                      checked={selected}
                      onChange={() => chooseOutcome(option.id)}
                      required
                    />
                    <span className={styles.outcomeMark} aria-hidden="true">
                      {selected ? <Check size={16} /> : null}
                    </span>
                    <span>
                      <strong>{option.label}</strong>
                      <small>{OUTCOME_DETAILS[option.id]}</small>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              className={styles.previewButton}
              type="submit"
              disabled={!outcome}
            >
              Preview report
            </button>

            <div
              className={styles.acknowledgement}
              role="status"
              aria-live="polite"
            >
              {reviewed && selectedOutcome ? (
                <>
                  <CircleCheck size={21} aria-hidden="true" />
                  <span>
                    <strong>Preview ready: {selectedOutcome.label}.</strong>
                    Nothing was saved. In the connected flow, this would enter
                    Contributions review before it could update Market Finder.
                  </span>
                </>
              ) : (
                <span>
                  Preview only. There is no submission API or durable write
                  behind this screen.
                </span>
              )}
            </div>

            <p className={styles.moderationNote}>
              Reports are private moderation inputs. Repeated reports still
              require evidence review; they do not automatically verify a shop
              or stock state.
            </p>
          </form>
        </div>

        <Link className={styles.standardContribute} href="/contribute">
          Share a normal product, routine or store contribution instead
        </Link>
      </div>
    </main>
  );
}
