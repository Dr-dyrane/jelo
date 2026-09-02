import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  MapPin,
  MapPinned,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { SmartBackLink } from "@/components/navigation/smart-back-link";
import { deriveMarketPrimaryAction } from "@/lib/markets/action";
import type {
  MarketSurfaceExternalAction,
  MarketSurfaceMarket,
  MarketSurfaceProduct,
} from "@/lib/markets/presentation";
import { ExactProductAnchor } from "./exact-product-anchor";
import { MarketFeedback } from "./market-feedback";
import type { MarketResultLead } from "./market-result-list";
import styles from "./market-finder.module.css";

type MarketShopLead = MarketResultLead & {
  stateLabel: string;
  externalAction?: MarketSurfaceExternalAction;
};

export function MarketShopDetail({
  lead,
  market,
  product,
  reportingEnabled = true,
  preview = false,
}: {
  lead: MarketShopLead;
  market: MarketSurfaceMarket;
  product: MarketSurfaceProduct;
  reportingEnabled?: boolean;
  preview?: boolean;
}) {
  const marketHref = `/markets/${market.slug}?product=${encodeURIComponent(product.slug)}`;
  const action = deriveMarketPrimaryAction(lead);
  const canShowDirections =
    action.kind === "directions" &&
    action.enabled &&
    lead.directions.length > 0;
  const canShowExternalAction = Boolean(action.enabled && lead.externalAction);

  return (
    <article className={styles.shopDetail} data-state={lead.state}>
      <section className={styles.shopHero} aria-labelledby="shop-lead-title">
        <div className={styles.shopHeroCopy}>
          <SmartBackLink className={styles.backLink} fallbackHref={marketHref}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </SmartBackLink>

          <span className={styles.detailStatus} data-state={lead.state}>
            {lead.stateLabel}
          </span>
          <p className="eyebrow">{market.name}</p>
          <h1 id="shop-lead-title">{lead.name}</h1>
          <p className={styles.detailLocation}>
            <MapPin size={18} aria-hidden="true" />
            {lead.locationLabel}
          </p>
          <div className={styles.truthChips} aria-label="Shop record context">
            <span>
              <Clock3 size={15} aria-hidden="true" />
              <time dateTime={lead.observedAt}>
                Checked {lead.observedAtLabel}
              </time>
            </span>
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Exact pack locked
            </span>
          </div>
        </div>

        <ExactProductAnchor product={product} />
      </section>

      <section
        className={styles.directionsSection}
        aria-labelledby="text-directions"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">03 · Directions</p>
            <h2 id="text-directions">
              {canShowDirections
                ? "Get there."
                : canShowExternalAction
                  ? "Contact the shop."
                  : "Travel paused."}
            </h2>
          </div>
          <p>
            {canShowDirections
              ? "Text directions for the final leg."
              : canShowExternalAction
                ? "Use the reviewed public contact."
                : "This record cannot safely route you yet."}
          </p>
        </div>

        <div className={styles.directionWorkspace}>
          {canShowDirections ? (
            <ol className={styles.directionSteps}>
              {lead.directions.map((direction, index) => (
                <li key={direction}>
                  <span aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{direction}</p>
                </li>
              ))}
            </ol>
          ) : canShowExternalAction && lead.externalAction ? (
            <a
              className={styles.shopExternalAction}
              href={lead.externalAction.href}
              target={
                lead.externalAction.href.startsWith("https://")
                  ? "_blank"
                  : undefined
              }
              rel={
                lead.externalAction.href.startsWith("https://")
                  ? "noreferrer"
                  : undefined
              }
            >
              {lead.externalAction.label}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          ) : (
            <div className={styles.directionsWithheld} data-state={lead.state}>
              {lead.state === "location-lead" &&
              !lead.actionEvidence.retailerLocationVerified ? (
                <PhoneOff size={24} aria-hidden="true" />
              ) : (
                <ShieldAlert size={24} aria-hidden="true" />
              )}
              <div>
                <strong>No directions shown.</strong>
                <p>
                  {lead.state === "location-lead"
                    ? lead.actionEvidence.retailerLocationVerified
                      ? "The shop is verified, but exact-pack branch stock still needs review."
                      : "Shop identity or contact still needs review."
                    : lead.state === "purchase-report"
                      ? "The purchase is reported, but the exact shop is unresolved."
                      : lead.state === "stale"
                        ? "The product observation has expired."
                        : lead.state === "disputed"
                          ? "The place reference is disputed."
                          : "This exact pack was reported unavailable."}
                </p>
              </div>
            </div>
          )}

          <details className={styles.evidenceDisclosure}>
            <summary>
              <span>
                <MapPinned size={18} aria-hidden="true" />
                Evidence for this record
              </span>
              <ChevronDown
                className={styles.disclosureChevron}
                size={20}
                aria-hidden="true"
              />
            </summary>
            <div className={styles.evidenceDisclosureBody}>
              <div>
                <small>Observation</small>
                <strong>{lead.evidenceLabel}</strong>
                <p>{lead.evidenceNote}</p>
              </div>
              <div>
                <small>Place identity</small>
                <strong>{lead.identityLabel}</strong>
              </div>
            </div>
          </details>

          <div className={styles.journeyChips} aria-label="Journey checks">
            <span>Confirm exact pack</span>
            <span>Stock can change</span>
            <span>
              {canShowDirections || canShowExternalAction
                ? preview
                  ? "Prototype route"
                  : "Reviewed action"
                : "No travel action"}
            </span>
          </div>
        </div>
      </section>

      <MarketFeedback
        marketSlug={market.slug}
        productSlug={product.slug}
        reportingEnabled={reportingEnabled}
        shopName={lead.name}
        shopSlug={lead.slug}
      />
    </article>
  );
}
