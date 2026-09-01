import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleX,
  CircleHelp,
  Clock3,
  MapPin,
  PhoneOff,
} from "lucide-react";
import {
  deriveMarketPrimaryAction,
  type MarketFixtureLead,
  type MarketFixtureProduct,
} from "@/lib/markets/fixture";
import styles from "./market-finder.module.css";

function StateIcon({ state }: { state: MarketFixtureLead["state"] }) {
  if (state === "purchase-report") {
    return <CircleHelp size={17} aria-hidden="true" />;
  }
  if (state === "location-lead") {
    return <PhoneOff size={17} aria-hidden="true" />;
  }
  if (state === "unavailable") return <CircleX size={17} aria-hidden="true" />;
  return <AlertTriangle size={17} aria-hidden="true" />;
}

function LeadCard({
  lead,
  marketSlug,
  product,
  rank,
}: {
  lead: MarketFixtureLead;
  marketSlug: string;
  product: MarketFixtureProduct;
  rank?: number;
}) {
  const action = deriveMarketPrimaryAction(lead);
  const shopHref = `/markets/${marketSlug}/shops/${lead.slug}?product=${encodeURIComponent(product.slug)}`;

  return (
    <li
      className={`${styles.resultCard} ${rank === undefined ? styles.resultCardNoRank : ""}`}
      data-state={lead.state}
    >
      {rank === undefined ? null : (
        <div className={styles.resultNumber} aria-hidden="true">
          {String(rank).padStart(2, "0")}
        </div>
      )}

      <div className={styles.resultBody}>
        <div className={styles.resultStatus} data-state={lead.state}>
          <StateIcon state={lead.state} />
          <span>{lead.stateLabel}</span>
        </div>

        <h2>{lead.name}</h2>

        <p className={styles.locationLine}>
          <MapPin size={16} aria-hidden="true" />
          <span>{lead.locationLabel}</span>
        </p>

        <div className={styles.evidenceBlock}>
          <strong>{lead.evidenceLabel}</strong>
          <p>{lead.evidenceNote}</p>
          <span>
            <Clock3 size={15} aria-hidden="true" />
            Evidence date{" "}
            <time dateTime={lead.observedAt}>{lead.observedAtLabel}</time>
          </span>
        </div>

        <p className={styles.identityLine}>{lead.identityLabel}</p>

        <div className={styles.resultActions}>
          {action.enabled && lead.kind === "shop" ? (
            <Link className={styles.primaryAction} href={shopHref}>
              {action.label}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          ) : (
            <span className={styles.pausedAction} aria-disabled="true">
              {action.label}
            </span>
          )}

          {lead.kind === "shop" && !action.enabled ? (
            <Link className={styles.textAction} href={shopHref}>
              Review record
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function MarketResultList({
  leads,
  marketSlug,
  product,
}: {
  leads: readonly MarketFixtureLead[];
  marketSlug: string;
  product: MarketFixtureProduct;
}) {
  if (!leads.length) {
    return (
      <div className={styles.emptyResults} data-state="empty">
        <p className={styles.kicker}>No physical lead yet</p>
        <h2>Keep the exact product selected.</h2>
        <p>
          This research fixture has no Trade Fair observation for{" "}
          {product.brand} {product.name}, {product.size}. Online listings must
          not be presented as a market shop.
        </p>
        <Link href="/markets">Choose another exact product</Link>
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
          {readyLeads.map((lead, index) => (
            <LeadCard
              key={lead.slug}
              lead={lead}
              marketSlug={marketSlug}
              product={product}
              rank={index + 1}
            />
          ))}
        </ol>
      ) : (
        <div className={styles.emptyResults} data-state="empty">
          <p className={styles.kicker}>No reviewed place yet</p>
          <h2>Keep the exact pack selected.</h2>
          <p>
            The reports below are useful research, but none has both a verified
            shop identity and a usable travel or contact action.
          </p>
        </div>
      )}

      {researchRecords.length ? (
        <section
          className={styles.researchRecords}
          aria-labelledby="market-research-records"
        >
          <div className={styles.recordsIntro}>
            <p className={styles.kicker}>
              Not ranked · do not travel from these
            </p>
            <h3 id="market-research-records">Recent reports and warnings</h3>
            <p>Preserved for verification, not presented as places to try.</p>
          </div>
          <ul className={styles.resultList}>
            {researchRecords.map((lead) => (
              <LeadCard
                key={lead.slug}
                lead={lead}
                marketSlug={marketSlug}
                product={product}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
