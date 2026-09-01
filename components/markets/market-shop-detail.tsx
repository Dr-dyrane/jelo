import Link from "next/link";
import { ArrowLeft, MapPinned, PhoneOff, ShieldAlert } from "lucide-react";
import type {
  MarketFixture,
  MarketFixtureLead,
  MarketFixtureProduct,
} from "@/lib/markets/fixture";
import { deriveMarketPrimaryAction } from "@/lib/markets/fixture";
import { MarketFeedback } from "./market-feedback";
import styles from "./market-finder.module.css";

export function MarketShopDetail({
  lead,
  market,
  product,
}: {
  lead: MarketFixtureLead;
  market: MarketFixture;
  product: MarketFixtureProduct;
}) {
  const marketHref = `/markets/${market.slug}?product=${encodeURIComponent(product.slug)}`;
  const action = deriveMarketPrimaryAction(lead);

  return (
    <div className={styles.shopDetail} data-state={lead.state}>
      <Link className={styles.backAction} href={marketHref}>
        <ArrowLeft size={17} aria-hidden="true" />
        Back to {market.name} results
      </Link>

      <section className={styles.detailHero} aria-labelledby="shop-lead-title">
        <div>
          <div className={styles.detailStatus} data-state={lead.state}>
            {lead.stateLabel}
          </div>
          <p className={styles.kicker}>Research shop record</p>
          <h1 id="shop-lead-title">{lead.name}</h1>
          <p className={styles.detailLocation}>{lead.locationLabel}</p>
        </div>

        <div className={styles.detailEvidence}>
          <strong>{lead.evidenceLabel}</strong>
          <p>{lead.evidenceNote}</p>
          <span>{lead.identityLabel}</span>
        </div>
      </section>

      <section
        className={styles.directionsPanel}
        aria-labelledby="text-directions"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Final-leg guidance</p>
            <h2 id="text-directions">Text directions</h2>
          </div>
          <MapPinned size={23} aria-hidden="true" />
        </div>

        {action.enabled && lead.directions.length ? (
          <ol className={styles.directionSteps}>
            {lead.directions.map((direction, index) => (
              <li key={direction}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{direction}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.directionsWithheld} data-state={lead.state}>
            {lead.state === "location-lead" ? (
              <PhoneOff size={21} aria-hidden="true" />
            ) : (
              <ShieldAlert size={21} aria-hidden="true" />
            )}
            <div>
              <strong>Directions intentionally withheld.</strong>
              <p>
                {lead.state === "location-lead"
                  ? "The fixture has no reviewed phone number or resolved branch identity. Do not travel from this lead."
                  : lead.state === "purchase-report"
                    ? "The purchase report identifies the exact product, but not a verified shop or final-leg route. Do not travel from this record."
                    : "This product report should promote another lead instead of routing someone to a shop with no reported stock."}
              </p>
            </div>
          </div>
        )}

        <p className={styles.fixtureNotice}>
          Prototype only. Confirm the exact pack, shop identity and current
          stock before any real journey.
        </p>
      </section>

      <MarketFeedback
        marketSlug={market.slug}
        productSlug={product.slug}
        shopName={lead.name}
        shopSlug={lead.slug}
      />
    </div>
  );
}
