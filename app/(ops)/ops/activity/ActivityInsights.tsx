"use client";

import Link from "next/link";
import {
  Activity,
  BookOpen,
  ChevronRight,
  Eye,
  FileText,
  GitFork,
  History,
  Search,
  Store,
} from "lucide-react";
import { RelativeTime } from "@/components/ops/chips/RelativeTime";
import {
  InboxContainer,
  type InboxCollectionSection,
} from "@/components/ops/inbox/InboxContainer";
import { OpsRecordVisual } from "@/components/ops/visuals/OpsRecordVisual";
import type {
  ActivityDecision,
  ActivityInference,
} from "@/lib/moderation/activity-read-model";
import { activityObservationHref } from "@/lib/moderation/activity-links";
import styles from "./activity.module.css";

const number = new Intl.NumberFormat("en-NG");
const exactTime = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
});
const noteDate = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const queueLabels: Record<ActivityDecision["queue"], string> = {
  community_contribution: "Community note",
  community_edge: "Relationship",
  community_observation: "Observation",
  community_moderation_value: "Vocabulary",
  community_research_task: "Research",
  retailer_application: "Retailer",
  market_finder_report: "Market report",
  retailer_location: "Retailer location",
  physical_product_observation: "Market evidence",
  commerce_signal: "Commerce signal",
};

const actionLabels: Record<ActivityDecision["action"], string> = {
  claim: "Claimed",
  assign: "Assigned",
  unassign: "Unassigned",
  approve: "Approved",
  reject: "Rejected",
  map: "Mapped",
  promote: "Promoted",
  reconcile: "Reconciled",
  defer: "Deferred",
  retry: "Retried",
  note: "Noted",
};

function QueueIcon({ queue }: { queue: ActivityDecision["queue"] }) {
  const Icon =
    queue === "community_contribution"
      ? FileText
      : queue === "community_edge"
        ? GitFork
        : queue === "community_observation"
          ? Eye
          : queue === "community_moderation_value"
            ? BookOpen
            : queue === "community_research_task"
              ? Search
              : queue === "retailer_application"
                ? Store
                : Activity;
  return <Icon size={18} strokeWidth={1.7} aria-hidden="true" />;
}

type DonutSlice = {
  count: number;
  label: string;
  tone: string;
};

function CompositionDonut({
  total,
  totalLabel,
  slices,
}: {
  total: number;
  totalLabel: string;
  slices: DonutSlice[];
}) {
  const visibleSlices = slices.filter((slice) => slice.count > 0);
  const sliceTotal = visibleSlices.reduce((sum, slice) => sum + slice.count, 0);
  const arcs = visibleSlices.reduce<
    Array<DonutSlice & { length: number; offset: number }>
  >((result, slice) => {
    const previous = result[result.length - 1];
    const length = sliceTotal > 0 ? (slice.count / sliceTotal) * 100 : 0;
    const offset = previous ? previous.offset + previous.length : 0;
    return [...result, { ...slice, length, offset }];
  }, []);
  const accessibleLabel = `${number.format(total)} ${totalLabel}: ${slices
    .map((slice) => `${number.format(slice.count)} ${slice.label}`)
    .join(", ")}`;

  return (
    <figure
      className={styles.donutFigure}
      role="img"
      aria-label={accessibleLabel}
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className={styles.donutTrack} cx="40" cy="40" r="29" />
        {arcs.map((arc) => (
          <circle
            className={styles.donutArc}
            data-tone={arc.tone}
            cx="40"
            cy="40"
            r="29"
            pathLength="100"
            strokeDasharray={`${arc.length} ${100 - arc.length}`}
            strokeDashoffset={-arc.offset}
            key={arc.tone}
          />
        ))}
      </svg>
    </figure>
  );
}

function RankList({
  items,
  empty,
  denominator,
}: {
  items: ActivityInference["community"]["topPurposes"];
  empty: string;
  denominator: number;
}) {
  if (items.length === 0) return <p className={styles.emptyMeasure}>{empty}</p>;

  return (
    <ol className={styles.rankList}>
      {items.map((item) => (
        <li key={item.label}>
          <span className={styles.rankCopy}>
            <span>{item.label}</span>
            <strong>{number.format(item.count)}</strong>
          </span>
          <span className={styles.rankTrack} aria-hidden="true">
            <span
              style={{
                width: `${denominator > 0 ? Math.min((item.count / denominator) * 100, 100) : 0}%`,
              }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

function DecisionDetail({ decision }: { decision: ActivityDecision }) {
  const observationHref = activityObservationHref(
    decision.queue,
    decision.targetRef,
  );
  return (
    <div className={styles.detail}>
      <div className={styles.detailScroll}>
        <section className={styles.detailIdentity}>
          <OpsRecordVisual
            image={decision.image}
            className={styles.detailVisual}
            imageClassName={styles.detailImage}
            fallback={<QueueIcon queue={decision.queue} />}
          />
          <div>
            <h2>{decision.targetLabel}</h2>
            <p>
              {actionLabels[decision.action]}{" "}
              {queueLabels[decision.queue].toLowerCase()}
            </p>
          </div>
        </section>

        {decision.rationale ? (
          <section className={styles.detailSection}>
            <h3>Reason</h3>
            <p>{decision.rationale}</p>
          </section>
        ) : null}

        <section className={styles.detailSection}>
          <h3>Recorded</h3>
          <dl className={styles.detailFacts}>
            <div>
              <dt>By</dt>
              <dd>{decision.operatorName}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{exactTime.format(new Date(decision.createdAt))}</dd>
            </div>
            {decision.canonicalWrite ? (
              <div>
                <dt>Catalogue</dt>
                <dd>Updated</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {observationHref ? (
          <Link href={observationHref} className={styles.reviewDecisionLink}>
            View report
          </Link>
        ) : null}

        <details className={styles.metadata}>
          <summary>More context</summary>
          <dl>
            <div>
              <dt>Workstream</dt>
              <dd>{queueLabels[decision.queue]}</dd>
            </div>
            <div>
              <dt>Source record</dt>
              <dd>
                <code>{decision.targetRef}</code>
              </dd>
            </div>
          </dl>
        </details>
      </div>
    </div>
  );
}

function approvedNoteWindow(
  firstNoteAt: string | null,
  lastNoteAt: string | null,
  activeDays: number,
) {
  if (!firstNoteAt || !lastNoteAt) return "No approved notes yet";
  const first = noteDate.format(new Date(firstNoteAt));
  const last = noteDate.format(new Date(lastNoteAt));
  const range = first === last ? first : `${first} – ${last}`;
  return `${range} · ${number.format(activeDays)} active ${activeDays === 1 ? "day" : "days"}`;
}

export function ActivityInsights({
  inference,
}: {
  inference: ActivityInference;
}) {
  const community = inference.community;
  const research = inference.research;
  const evidence = inference.evidence;
  const decisions = inference.audit.decisions;
  const decisionCountLabel =
    decisions.length < inference.audit.totalDecisions
      ? `All time · latest ${number.format(decisions.length)} of ${number.format(inference.audit.totalDecisions)}`
      : `All time · ${number.format(inference.audit.totalDecisions)} decisions`;
  const sections: InboxCollectionSection<ActivityDecision>[] = [
    {
      id: "decision-history",
      label: "Decision history",
      presentation: "compact-rows",
      itemIds: decisions.map((decision) => decision.id),
      pagination: { initialCount: 12, pageSize: 12 },
    },
  ];

  return (
    <div className={styles.surface}>
      <section className={styles.snapshotRail} aria-label="Community snapshot">
        <article className={styles.snapshotCard} data-tone="peach">
          <div className={styles.snapshotCopy}>
            <span className={styles.eyebrow}>Community knowledge</span>
            <strong className={styles.heroNumber}>
              {number.format(community.approvedNotes)}
            </strong>
            <h2>Approved notes</h2>
            <p>
              {number.format(community.productNotes)} products ·{" "}
              {number.format(community.routineNotes)} routines ·{" "}
              {number.format(community.storeNotes)} stores
            </p>
            <small className={styles.snapshotMeta}>
              {approvedNoteWindow(
                community.firstNoteAt,
                community.lastNoteAt,
                community.activeDays,
              )}
            </small>
          </div>
          <CompositionDonut
            total={community.approvedNotes}
            totalLabel="approved notes"
            slices={[
              {
                count: community.productNotes,
                label: "product notes",
                tone: "product",
              },
              {
                count: community.routineNotes,
                label: "routine notes",
                tone: "routine",
              },
              {
                count: community.storeNotes,
                label: "store notes",
                tone: "store",
              },
            ]}
          />
        </article>

        <article className={styles.snapshotCard} data-tone="pink">
          <div className={styles.snapshotCopy}>
            <span className={styles.eyebrow}>Product research</span>
            <strong className={styles.heroNumber}>
              {number.format(research.resolvedProductResearch)}
            </strong>
            <h2>Leads resolved</h2>
            <p>
              {number.format(research.matchedExisting)} matched ·{" "}
              {number.format(research.intakeCandidates)} intake ·{" "}
              {number.format(research.needClarity)} need clarity ·{" "}
              {number.format(research.sets)}{" "}
              {research.sets === 1 ? "set" : "sets"}
              {research.dismissedDuplicates > 0
                ? ` · ${number.format(research.dismissedDuplicates)} dismissed`
                : ""}
            </p>
            <small className={styles.snapshotMeta}>
              All time · {number.format(research.resolvedProductResearch)} of{" "}
              {number.format(research.productLeads)} product leads
            </small>
          </div>
          <CompositionDonut
            total={research.resolvedProductResearch}
            totalLabel="resolved product leads"
            slices={[
              {
                count: research.matchedExisting,
                label: "matched",
                tone: "matched",
              },
              {
                count: research.intakeCandidates,
                label: "intake candidates",
                tone: "intake",
              },
              {
                count: research.needClarity,
                label: "need clarity",
                tone: "clarity",
              },
              {
                count: research.sets,
                label: research.sets === 1 ? "set" : "sets",
                tone: "set",
              },
              {
                count: research.dismissedDuplicates,
                label: "dismissed duplicates",
                tone: "dismissed",
              },
            ]}
          />
        </article>
      </section>

      <section className={styles.patterns} aria-labelledby="patterns-heading">
        <header className={styles.sectionHeading}>
          <h2 id="patterns-heading">What comes up</h2>
          <span>
            Early sample · {number.format(community.approvedNotes)} approved
            notes
          </span>
        </header>
        <div className={styles.patternColumns}>
          <div>
            <h3>Skin needs</h3>
            <RankList
              items={community.topPurposes}
              empty="More notes are needed before a pattern appears."
              denominator={community.approvedNotes}
            />
          </div>
          <div>
            <h3>Store mentions</h3>
            <RankList
              items={community.topRetailers}
              empty="No store has appeared in enough approved notes yet."
              denominator={community.approvedNotes}
            />
          </div>
        </div>
        <p className={styles.boundary}>
          Community reported. These mentions guide research; they do not prove
          results or retailer trust.
        </p>
      </section>

      <section className={styles.evidence} aria-labelledby="evidence-heading">
        <header className={styles.sectionHeading}>
          <h2 id="evidence-heading">What the notes added</h2>
          <span>
            Updated <RelativeTime iso={inference.generatedAt} />
          </span>
        </header>
        <div className={styles.evidenceRows}>
          <div>
            <span>Relationships</span>
            <strong>
              {number.format(evidence.approvedRelationships)} approved
            </strong>
            <small>
              {number.format(evidence.pendingRelationships)} waiting
            </small>
          </div>
          <div>
            <span>Observations</span>
            <strong>
              {number.format(evidence.approvedObservations)} approved
            </strong>
            <small>{number.format(evidence.pendingObservations)} waiting</small>
          </div>
          <div>
            <span>Retailer research</span>
            <strong>{number.format(research.retailerLeads)} leads</strong>
            <small>
              {number.format(research.pendingRetailerResearch)} waiting
            </small>
          </div>
          <div>
            <span>Notes include</span>
            <strong>
              {number.format(community.experienceNotes)} experiences
            </strong>
            <small>{number.format(community.priceNotes)} prices</small>
          </div>
        </div>
      </section>

      <section className={styles.history} aria-label="Recorded decisions">
        <header className={styles.sectionHeading}>
          <h2>Activity</h2>
          <span>{decisionCountLabel}</span>
        </header>
        {decisions.length > 0 ? (
          <div className={styles.ledger}>
            <InboxContainer
              items={decisions}
              sections={sections}
              itemTypeLabel="decision"
              collectionLabel="Decision history"
              globalKeyboardShortcuts={false}
              getItemLabel={(decision) => decision.targetLabel}
              renderItemRow={(decision) => (
                <span className={styles.decisionRow}>
                  <OpsRecordVisual
                    image={decision.image}
                    className={styles.decisionVisual}
                    imageClassName={styles.decisionImage}
                    fallback={<QueueIcon queue={decision.queue} />}
                  />
                  <span className={styles.decisionCopy}>
                    <span className={styles.decisionAction}>
                      {actionLabels[decision.action]}{" "}
                      {queueLabels[decision.queue].toLowerCase()}
                    </span>
                    <strong>{decision.targetLabel}</strong>
                    <span className={styles.decisionMeta}>
                      {decision.operatorName} ·{" "}
                      <RelativeTime iso={decision.createdAt} />
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className={styles.decisionCaret}
                    aria-hidden="true"
                  />
                </span>
              )}
              renderItemDetails={(decision) => (
                <DecisionDetail decision={decision} />
              )}
            />
          </div>
        ) : (
          <p className={styles.emptyMeasure}>No decisions recorded yet.</p>
        )}
      </section>

      <p className={styles.auditNote}>
        <History size={15} aria-hidden="true" />
        Decisions stay recorded. Raw references remain in each item’s details.
      </p>
    </div>
  );
}
