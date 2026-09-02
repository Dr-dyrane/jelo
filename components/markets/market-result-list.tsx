import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock3,
  History,
  MapPin,
  MapPinOff,
  PhoneOff,
  ShieldCheck,
  Store,
} from "lucide-react";
import { deriveMarketPrimaryAction } from "@/lib/markets/action";
import type { MarketSurfaceProduct } from "@/lib/markets/presentation";
import styles from "./market-finder.module.css";

export type MarketResultLead = {
  kind: "shop" | "direction-alert";
  slug: string;
  state:
    | "ready"
    | "purchase-report"
    | "location-lead"
    | "stale"
    | "unavailable"
    | "disputed";
  name: string;
  stateLabel: string;
  locationLabel: string;
  identityLabel: string;
  evidenceLabel: string;
  evidenceNote: string;
  observedAt?: string;
  observedAtLabel?: string;
  expiresAt?: string;
  expiresAtLabel?: string;
  directions: readonly string[];
  detailRecordAvailable?: boolean;
  actionEvidence: {
    exactProductIdentity: true;
    retailerLocationVerified: boolean;
    observationReviewed: boolean;
    usableAction: "directions" | "contact" | null;
  };
};

function StateIcon({ lead }: { lead: MarketResultLead }) {
  const { state } = lead;
  if (state === "ready") {
    return <CircleCheck size={17} aria-hidden="true" />;
  }
  if (state === "purchase-report") {
    return <CircleHelp size={17} aria-hidden="true" />;
  }
  if (state === "location-lead") {
    return lead.actionEvidence.retailerLocationVerified ? (
      <CircleHelp size={17} aria-hidden="true" />
    ) : (
      <PhoneOff size={17} aria-hidden="true" />
    );
  }
  if (state === "stale") return <History size={17} aria-hidden="true" />;
  if (state === "unavailable") return <CircleX size={17} aria-hidden="true" />;
  return <AlertTriangle size={17} aria-hidden="true" />;
}

function PlaceIcon({
  lead,
  compact,
}: {
  lead: MarketResultLead;
  compact: boolean;
}) {
  if (lead.kind === "direction-alert") {
    return (
      <MapPinOff
        size={compact ? 23 : 30}
        strokeWidth={1.55}
        aria-hidden="true"
      />
    );
  }

  return (
    <Store size={compact ? 23 : 30} strokeWidth={1.55} aria-hidden="true" />
  );
}

function freshnessLabel(lead: MarketResultLead) {
  if (lead.state === "stale" && lead.expiresAt && lead.expiresAtLabel) {
    return {
      label: "Expired",
      dateTime: lead.expiresAt,
      date: lead.expiresAtLabel,
    };
  }

  if (!lead.observedAt || !lead.observedAtLabel) return null;

  return {
    label:
      lead.state === "ready" || lead.actionEvidence.retailerLocationVerified
        ? "Checked"
        : "Reported",
    dateTime: lead.observedAt,
    date: lead.observedAtLabel,
  };
}

function LeadCard({
  lead,
  marketSlug,
  product,
  compact = false,
}: {
  lead: MarketResultLead;
  marketSlug: string;
  product: MarketSurfaceProduct;
  compact?: boolean;
}) {
  const action = deriveMarketPrimaryAction(lead);
  const freshness = freshnessLabel(lead);
  const shopHref = `/markets/${marketSlug}/shops/${lead.slug}?product=${encodeURIComponent(product.slug)}`;
  const actionLabel = action.enabled ? "View shop" : action.label;

  return (
    <li
      className={`${styles.resultCard} ${compact ? styles.resultCardCompact : ""}`}
      data-state={lead.state}
    >
      <span className={styles.resultVisual} data-state={lead.state}>
        <PlaceIcon lead={lead} compact={compact} />
        <span className={styles.resultVisualState}>
          <StateIcon lead={lead} />
        </span>
      </span>

      <div className={styles.resultBody}>
        <div className={styles.resultMetaRow}>
          <span className={styles.resultStatus} data-state={lead.state}>
            {lead.stateLabel}
          </span>
          {freshness ? (
            <span className={styles.freshnessLine}>
              {lead.state === "stale" ? (
                <History size={14} aria-hidden="true" />
              ) : (
                <Clock3 size={14} aria-hidden="true" />
              )}
              {freshness.label}{" "}
              <time dateTime={freshness.dateTime}>{freshness.date}</time>
            </span>
          ) : null}
        </div>

        <h3>{lead.name}</h3>

        <p className={styles.locationLine}>
          <MapPin size={16} aria-hidden="true" />
          <span>{lead.locationLabel}</span>
        </p>

        {compact ? (
          <>
            <p className={styles.recordNote}>{lead.evidenceNote}</p>
            {lead.kind === "shop" && lead.detailRecordAvailable === true ? (
              <Link
                className={styles.recordAction}
                href={shopHref}
                aria-label={`Review ${lead.name}`}
              >
                View record
                <ChevronRight size={17} aria-hidden="true" />
              </Link>
            ) : (
              <span className={styles.pausedAction} aria-disabled="true">
                No travel action
              </span>
            )}
          </>
        ) : (
          <>
            <div className={styles.resultActions}>
              {action.enabled && lead.kind === "shop" ? (
                <Link className={styles.primaryAction} href={shopHref}>
                  {actionLabel}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <span className={styles.pausedAction} aria-disabled="true">
                  {lead.stateLabel}
                </span>
              )}
            </div>

            <details className={styles.resultEvidence}>
              <summary>
                <span>
                  <ShieldCheck size={16} aria-hidden="true" />
                  Why this result
                </span>
                <ChevronDown
                  className={styles.disclosureChevron}
                  size={18}
                  aria-hidden="true"
                />
              </summary>
              <div>
                <strong>{lead.evidenceLabel}</strong>
                <p>{lead.evidenceNote}</p>
                <span>{lead.identityLabel}</span>
              </div>
            </details>
          </>
        )}
      </div>
    </li>
  );
}

export function MarketResultList({
  leads,
  marketSlug,
  product,
}: {
  leads: readonly MarketResultLead[];
  marketSlug: string;
  product: MarketSurfaceProduct;
}) {
  if (!leads.length) {
    return (
      <div className={styles.emptyResults} data-state="empty">
        <span className={styles.emptyResultIcon} aria-hidden="true">
          <MapPin size={28} />
        </span>
        <div>
          <p className={styles.kicker}>No confirmed place</p>
          <h2>Nothing ready yet.</h2>
          <p>We’ll show a route after the shop and exact pack are checked.</p>
        </div>
        <Link href="/markets">Choose another product</Link>
      </div>
    );
  }

  const readyLeads = leads.filter(
    (lead) => deriveMarketPrimaryAction(lead).enabled,
  );
  const researchRecords = leads.filter(
    (lead) => !deriveMarketPrimaryAction(lead).enabled,
  );

  return (
    <>
      {readyLeads.length ? (
        <ol className={styles.resultList} id="market-results">
          {readyLeads.map((lead) => (
            <LeadCard
              key={lead.slug}
              lead={lead}
              marketSlug={marketSlug}
              product={product}
            />
          ))}
        </ol>
      ) : (
        <div className={styles.emptyResults} data-state="empty">
          <span className={styles.emptyResultIcon} aria-hidden="true">
            <MapPin size={28} />
          </span>
          <div>
            <p className={styles.kicker}>No confirmed place</p>
            <h2>Nothing ready yet.</h2>
            <p>These records still need checking.</p>
          </div>
        </div>
      )}

      {researchRecords.length ? (
        <details className={styles.researchRecords}>
          <summary className={styles.recordsSummary}>
            <span className={styles.recordsIcon} aria-hidden="true">
              <History size={20} />
            </span>
            <span className={styles.recordsSummaryCopy}>
              <strong>Other reports and warnings</strong>
              <small>
                {researchRecords.length}{" "}
                {researchRecords.length === 1 ? "record needs" : "records need"}{" "}
                checking
              </small>
            </span>
            <ChevronDown
              className={styles.disclosureChevron}
              size={20}
              aria-hidden="true"
            />
          </summary>
          <div className={styles.recordsBody}>
            <ul className={`${styles.resultList} ${styles.compactResultList}`}>
              {researchRecords.map((lead) => (
                <LeadCard
                  key={lead.slug}
                  lead={lead}
                  marketSlug={marketSlug}
                  product={product}
                  compact
                />
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </>
  );
}
