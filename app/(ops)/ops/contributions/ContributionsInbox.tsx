"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ChevronRight, Layers3, PackageOpen, Store } from "lucide-react";
import type { ContributionDisplayValue } from "@/lib/moderation/contribution-presentation";
import { money } from "@/lib/format/money";
import { outcomeLabel, outcomeTone } from "@/lib/humanize/outcomes";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { EmptyState } from "@/components/ops/state/EmptyState";
import { StatusPill } from "@/components/ops/chips/StatusPill";
import { RelativeTime } from "@/components/ops/chips/RelativeTime";
import { IdChip } from "@/components/ops/chips/IdChip";
import {
  InboxContainer,
  type InboxCollectionSection,
  type OpsInboxController,
} from "@/components/ops/inbox/InboxContainer";
import { useUrlInboxSelection } from "@/components/ops/inbox/use-url-inbox-selection";
import { decideContributionAction } from "../actions";
import {
  decideMarketFinderReportAction,
  fetchMoreContributionsAction,
} from "./actions";
import {
  exactMarketProductLabel,
  marketFinderOutcomeLabel,
} from "./market-report-labels";
import type { ContributionWorkItem } from "./market-report-presentation";
import { ContributionDetailSkeleton } from "./ContributionDetailSkeleton";
import styles from "@/components/ops/inbox/inbox.module.css";
import contributionStyles from "./contributions.module.css";

interface ContributionsInboxProps {
  rows: ContributionWorkItem[];
  canDecide: boolean;
  canDecideMarketReports: boolean;
  initialHasMore: boolean;
  initialCursor: ContributionCursor | null;
}

type ContributionCursor = {
  submittedAt: string;
  id: string;
};

type QueueRuntimeState = {
  extraRows: ContributionWorkItem[];
  settledIds: string[];
  parentApprovedIds: string[];
  cursor: ContributionCursor | null;
  hasMore: boolean;
  isLoading: boolean;
  loadError: string | null;
};

type QueueRuntimeAction =
  | { type: "load-start" }
  | {
      type: "load-success";
      rows: ContributionWorkItem[];
      cursor: ContributionCursor | null;
      hasMore: boolean;
    }
  | { type: "load-error" }
  | { type: "settled"; id: string }
  | { type: "parent-approved"; id: string };

function queueRuntimeReducer(
  state: QueueRuntimeState,
  action: QueueRuntimeAction,
): QueueRuntimeState {
  if (action.type === "load-start") {
    return { ...state, isLoading: true, loadError: null };
  }
  if (action.type === "load-error") {
    return {
      ...state,
      isLoading: false,
      loadError: "Couldn’t load more contributions.",
    };
  }
  if (action.type === "settled") {
    return {
      ...state,
      extraRows: state.extraRows.filter((row) => row.id !== action.id),
      settledIds: state.settledIds.includes(action.id)
        ? state.settledIds
        : [...state.settledIds, action.id],
    };
  }
  if (action.type === "parent-approved") {
    return {
      ...state,
      parentApprovedIds: state.parentApprovedIds.includes(action.id)
        ? state.parentApprovedIds
        : [...state.parentApprovedIds, action.id],
    };
  }

  const settled = new Set(state.settledIds);
  const knownIds = new Set(state.extraRows.map((row) => row.id));
  const newRows = action.rows.filter((row) => {
    if (settled.has(row.id) || knownIds.has(row.id)) return false;
    knownIds.add(row.id);
    return true;
  });
  return {
    ...state,
    extraRows: [...state.extraRows, ...newRows],
    cursor: action.cursor,
    hasMore: action.hasMore,
    isLoading: false,
    loadError: null,
  };
}

function contributionRows(
  initialRows: ContributionWorkItem[],
  state: QueueRuntimeState,
) {
  const settled = new Set(state.settledIds);
  const parentApproved = new Set(state.parentApprovedIds);
  const byId = new Map<string, ContributionWorkItem>();
  [...initialRows, ...state.extraRows].forEach((row) => {
    if (!settled.has(row.id)) {
      byId.set(
        row.id,
        parentApproved.has(row.id)
          ? { ...row, parentModerationStatus: "approved" }
          : row,
      );
    }
  });
  return [...byId.values()];
}

function ContributionVisual({
  kind,
  image,
  className,
  imageClassName,
  iconSize = 22,
}: {
  kind: ContributionWorkItem["kind"];
  image: string | null;
  className: string;
  imageClassName: string;
  iconSize?: number;
}) {
  const Icon =
    kind === "routine" ? Layers3 : kind === "store" ? Store : PackageOpen;
  return (
    <span className={className} aria-hidden="true">
      {image ? (
        <SafeProductImage src={image} alt="" className={imageClassName} />
      ) : (
        <Icon size={iconSize} strokeWidth={1.65} />
      )}
    </span>
  );
}

function SubmittedValues({ values }: { values: ContributionDisplayValue[] }) {
  return (
    <span className={contributionStyles.submittedValues}>
      {values.map((value, index) => (
        <span
          key={`${value.label}-${index}`}
          className={contributionStyles.submittedValue}
        >
          <span>{value.label}</span>
          {value.match === "new" ? (
            <span className={contributionStyles.newValue}>New</span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function SummaryAndTime({
  summary,
  submittedAt,
}: {
  summary: string;
  submittedAt: string;
}) {
  return (
    <>
      {summary ? (
        <>
          <span>{summary}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <RelativeTime iso={submittedAt} />
    </>
  );
}

function moderationStatusLabel(
  status: "pending" | "mapped" | "approved" | "rejected",
) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "mapped") return "Mapped";
  return "Pending";
}

function moderationStatusTone(
  status: "pending" | "mapped" | "approved" | "rejected",
) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "danger" as const;
  return status === "mapped" ? ("info" as const) : ("warning" as const);
}

function marketOutcomeTone(
  outcome: NonNullable<ContributionWorkItem["marketReport"]>["outcome"],
) {
  if (outcome === "found_bought") return "success" as const;
  if (outcome === "shop_exists_no_stock") return "warning" as const;
  return "danger" as const;
}

function DecisionAnnouncement({ message }: { message: string }) {
  return (
    <span
      className={contributionStyles.liveStatus}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </span>
  );
}

export function ContributionsInbox({
  rows,
  canDecide,
  canDecideMarketReports,
  initialHasMore,
  initialCursor,
}: ContributionsInboxProps) {
  const selection = useUrlInboxSelection();
  const [actionState, formAction, isPending] = useActionState(
    decideContributionAction,
    null,
  );
  const [marketActionState, marketFormAction, isMarketPending] = useActionState(
    decideMarketFinderReportAction,
    null,
  );
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [queueState, dispatchQueue] = useReducer(queueRuntimeReducer, {
    extraRows: [],
    settledIds: [],
    parentApprovedIds: [],
    cursor: initialCursor,
    hasMore: initialHasMore,
    isLoading: false,
    loadError: null,
  });
  const pendingDecisionRef = useRef<string | null>(null);
  const pendingMarketDecisionRef = useRef<string | null>(null);
  const handledParentActionRef = useRef<typeof actionState>(null);
  const handledMarketActionRef = useRef<typeof marketActionState>(null);
  const [decisionAnnouncement, setDecisionAnnouncement] = useState("");
  const loadPendingRef = useRef(false);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);
  const loadedRows = useMemo(
    () => contributionRows(rows, queueState),
    [queueState, rows],
  );
  const orderedRows = useMemo(() => {
    const chronological = [...loadedRows].sort((left, right) => {
      if (left.submittedAt !== right.submittedAt) {
        return left.submittedAt < right.submittedAt ? -1 : 1;
      }
      return left.id.localeCompare(right.id, "en-NG");
    });
    const upNext = chronological.slice(0, 2);
    const remaining = chronological.slice(2);
    return [
      ...upNext,
      ...remaining.filter((row) => row.kind === "product"),
      ...remaining.filter((row) => row.kind === "routine"),
      ...remaining.filter((row) => row.kind === "store"),
    ];
  }, [loadedRows]);
  const sections = useMemo<InboxCollectionSection<ContributionWorkItem>[]>(
    () => [
      {
        id: "up-next",
        label: "Up next",
        presentation: "feature-shelf",
        itemIds: orderedRows.slice(0, 2).map((row) => row.id),
      },
      {
        id: "product-submissions",
        label: "Product submissions",
        presentation: "compact-rows",
        itemIds: orderedRows
          .filter((row, index) => index >= 2 && row.kind === "product")
          .map((row) => row.id),
        pagination: { initialCount: 8, pageSize: 8 },
      },
      {
        id: "routine-submissions",
        label: "Routine submissions",
        presentation: "horizontal-rail",
        itemIds: orderedRows
          .filter((row, index) => index >= 2 && row.kind === "routine")
          .map((row) => row.id),
        pagination: { initialCount: 5, pageSize: 5 },
      },
      {
        id: "store-submissions",
        label: "Store submissions",
        presentation: "compact-rows",
        itemIds: orderedRows
          .filter((row, index) => index >= 2 && row.kind === "store")
          .map((row) => row.id),
        pagination: { initialCount: 8, pageSize: 8 },
      },
    ],
    [orderedRows],
  );

  const loadMore = useCallback(async () => {
    if (
      loadPendingRef.current ||
      queueState.isLoading ||
      !queueState.hasMore ||
      !queueState.cursor
    ) {
      return;
    }

    loadPendingRef.current = true;
    dispatchQueue({ type: "load-start" });
    try {
      const result = await fetchMoreContributionsAction(
        queueState.cursor.submittedAt,
        queueState.cursor.id,
      );
      dispatchQueue({
        type: "load-success",
        rows: result.items,
        cursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      console.error("Could not load more contributions.", error);
      dispatchQueue({ type: "load-error" });
    } finally {
      loadPendingRef.current = false;
    }
  }, [queueState.cursor, queueState.hasMore, queueState.isLoading]);

  useEffect(() => {
    if (
      !queueState.hasMore ||
      queueState.loadError ||
      !loadSentinelRef.current
    ) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      {
        root: document.querySelector<HTMLElement>("[data-ops-main]"),
        rootMargin: "240px 0px",
        threshold: 0.01,
      },
    );
    observer.observe(loadSentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, queueState.hasMore, queueState.loadError]);

  useEffect(() => {
    if (!actionState?.ok || handledParentActionRef.current === actionState)
      return;
    handledParentActionRef.current = actionState;
    setDecisionAnnouncement(
      `Contribution ${actionState.decision === "approve" ? "approved" : "rejected"}.`,
    );
    const row = loadedRows.find((item) => item.id === actionState.targetId);
    if (
      actionState.decision === "approve" &&
      row?.marketReport?.moderationStatus === "pending"
    ) {
      dispatchQueue({ type: "parent-approved", id: actionState.targetId });
    } else {
      inboxControllerRef.current?.settleItem(actionState.targetId);
      dispatchQueue({ type: "settled", id: actionState.targetId });
    }
    pendingDecisionRef.current = null;
  }, [actionState, loadedRows]);

  useEffect(() => {
    if (
      !marketActionState?.ok ||
      handledMarketActionRef.current === marketActionState
    )
      return;
    handledMarketActionRef.current = marketActionState;
    setDecisionAnnouncement(
      `Market Finder report ${marketActionState.decision === "approve" ? "approved" : "rejected"}.`,
    );
    inboxControllerRef.current?.settleItem(marketActionState.targetId);
    dispatchQueue({ type: "settled", id: marketActionState.targetId });
    pendingMarketDecisionRef.current = null;
  }, [marketActionState]);

  const visibleDecisionAnnouncement =
    isPending || isMarketPending ? "" : decisionAnnouncement;

  if (orderedRows.length === 0 && !queueState.hasMore) {
    return (
      <>
        <EmptyState
          title="You’re caught up."
          body="There’s nothing waiting."
          action={{ href: "/ops/activity", label: "View insights" }}
        />
        <DecisionAnnouncement message={visibleDecisionAnnouncement} />
      </>
    );
  }

  return (
    <>
      <InboxContainer
        controllerRef={inboxControllerRef}
        items={orderedRows}
        sections={sections}
        itemTypeLabel="contribution"
        getItemLabel={(item) => item.title}
        selectedId={selection.selectedId}
        pendingSelectionId={selection.pendingSelectionId}
        onSelect={(item) => {
          setRejectConfirmId(null);
          selection.onSelect(item);
        }}
        onDeselect={() => {
          setRejectConfirmId(null);
          selection.onDeselect();
        }}
        renderItemRow={(row, _isActive, context) => {
          if (context?.presentation === "feature-shelf") {
            return (
              <span className={contributionStyles.featureCard}>
                <ContributionVisual
                  kind={row.kind}
                  image={row.image}
                  className={contributionStyles.featureVisual}
                  imageClassName={contributionStyles.featureImage}
                  iconSize={28}
                />
                <span className={contributionStyles.featureCopy}>
                  <span className={contributionStyles.featureEyebrow}>
                    {row.kindLabel}
                  </span>
                  <span className={contributionStyles.featureTitle}>
                    {row.title}
                  </span>
                  <span className={contributionStyles.featureMeta}>
                    <SummaryAndTime
                      summary={row.summary}
                      submittedAt={row.submittedAt}
                    />
                  </span>
                </span>
              </span>
            );
          }

          if (context?.presentation === "horizontal-rail") {
            return (
              <span className={contributionStyles.routineCard}>
                <ContributionVisual
                  kind={row.kind}
                  image={row.image}
                  className={contributionStyles.routineVisual}
                  imageClassName={contributionStyles.routineImage}
                />
                <span className={contributionStyles.routineCopy}>
                  <span className={contributionStyles.routineTitle}>
                    {row.title}
                  </span>
                  <span className={contributionStyles.routineMeta}>
                    <SummaryAndTime
                      summary={row.summary}
                      submittedAt={row.submittedAt}
                    />
                  </span>
                </span>
              </span>
            );
          }

          return (
            <span className={contributionStyles.compactRow}>
              <ContributionVisual
                kind={row.kind}
                image={row.image}
                className={contributionStyles.compactVisual}
                imageClassName={contributionStyles.compactImage}
              />
              <span className={contributionStyles.compactCopy}>
                <span className={contributionStyles.compactTitle}>
                  {row.title}
                </span>
                <span className={contributionStyles.compactMeta}>
                  <SummaryAndTime
                    summary={row.summary}
                    submittedAt={row.submittedAt}
                  />
                </span>
              </span>
              <ChevronRight
                size={16}
                className={contributionStyles.compactCaret}
                aria-hidden="true"
              />
            </span>
          );
        }}
        renderItemDetails={(row) => {
          if (selection.pendingSelectionId === row.id)
            return <ContributionDetailSkeleton />;

          const confirmationId = `reject-contribution-${row.id}`;
          const linkedReportCopy = `${row.pendingLinkedReportCount} ${
            row.pendingLinkedReportCount === 1 ? "report" : "reports"
          } waiting`;

          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <section
                  className={contributionStyles.identitySummary}
                  aria-label="Contribution subject"
                >
                  <ContributionVisual
                    kind={row.kind}
                    image={row.image}
                    className={contributionStyles.identityVisual}
                    imageClassName={contributionStyles.identityImage}
                    iconSize={26}
                  />
                  <div className={contributionStyles.identityCopy}>
                    <h2>{row.title}</h2>
                    <span>{row.kindLabel}</span>
                    <div className={contributionStyles.identityMeta}>
                      <RelativeTime iso={row.submittedAt} />
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Submitted details</h3>
                  <div className={styles.propertiesSection}>
                    {row.brandValues.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Brand</span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          <SubmittedValues values={row.brandValues} />
                        </span>
                      </div>
                    ) : null}
                    {row.productValues.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          {row.kind === "routine" ? "Products" : "Product"}
                        </span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          <SubmittedValues values={row.productValues} />
                        </span>
                      </div>
                    ) : null}
                    {row.storeValues.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Store</span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          <SubmittedValues values={row.storeValues} />
                        </span>
                      </div>
                    ) : null}
                    {row.purposeValues.length > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Used for</span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          <SubmittedValues values={row.purposeValues} />
                        </span>
                      </div>
                    ) : null}
                    {row.priceNgn != null ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Price</span>
                        <span className={styles.propertyValue}>
                          <span className={styles.value}>
                            {money(row.priceNgn)}
                          </span>
                        </span>
                      </div>
                    ) : null}
                    {row.outcome ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          How it went
                        </span>
                        <span className={styles.propertyValue}>
                          <StatusPill tone={outcomeTone(row.outcome)}>
                            {outcomeLabel(row.outcome)}
                          </StatusPill>
                        </span>
                      </div>
                    ) : null}
                    {row.purchaseDate ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Bought</span>
                        <span className={styles.propertyValue}>
                          <RelativeTime iso={row.purchaseDate} mode="date" />
                        </span>
                      </div>
                    ) : null}
                    {row.pendingLinkedReportCount > 0 ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Linked reports
                        </span>
                        <span className={styles.propertyValue}>
                          {linkedReportCopy}
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Submitted</span>
                      <span className={styles.propertyValue}>
                        <RelativeTime iso={row.submittedAt} />
                      </span>
                    </div>
                  </div>
                </section>

                {row.marketReport ? (
                  <section
                    className={`${styles.detailSection} ${contributionStyles.marketReportSection}`}
                  >
                    <h3 className={styles.sectionLabel}>Market report</h3>
                    <p className={contributionStyles.lockedContextNote}>
                      This is the exact server-resolved context submitted with
                      the report.
                    </p>
                    <div className={styles.propertiesSection}>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Exact product
                        </span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          {exactMarketProductLabel(row.marketReport)}
                        </span>
                      </div>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Identity version
                        </span>
                        <span className={styles.propertyValue}>
                          <IdChip
                            value={row.marketReport.productIdentityVersionId}
                            label="exact identity"
                          />
                        </span>
                      </div>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Market</span>
                        <span className={styles.propertyValue}>
                          {row.marketReport.marketName}
                        </span>
                      </div>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Retailer location
                        </span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          {row.marketReport.retailerName} ·{" "}
                          {row.marketReport.retailerLocationName}
                        </span>
                      </div>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Visit outcome
                        </span>
                        <span className={styles.propertyValue}>
                          <StatusPill
                            tone={marketOutcomeTone(row.marketReport.outcome)}
                          >
                            {marketFinderOutcomeLabel(row.marketReport.outcome)}
                          </StatusPill>
                        </span>
                      </div>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Parent state
                        </span>
                        <span className={styles.propertyValue}>
                          <StatusPill
                            tone={moderationStatusTone(
                              row.parentModerationStatus,
                            )}
                          >
                            {moderationStatusLabel(row.parentModerationStatus)}
                          </StatusPill>
                        </span>
                      </div>
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>
                          Report state
                        </span>
                        <span className={styles.propertyValue}>
                          <StatusPill
                            tone={moderationStatusTone(
                              row.marketReport.moderationStatus,
                            )}
                          >
                            {moderationStatusLabel(
                              row.marketReport.moderationStatus,
                            )}
                          </StatusPill>
                        </span>
                      </div>
                    </div>
                  </section>
                ) : null}

                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Source</span>
                      <span className={styles.propertyValue}>
                        {row.sourceLabel}
                      </span>
                    </div>
                    {row.campaignLabel ? (
                      <div className={styles.propertyRow}>
                        <span className={styles.propertyLabel}>Campaign</span>
                        <span
                          className={`${styles.propertyValue} ${contributionStyles.multilineValue}`}
                        >
                          {row.campaignLabel}
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Keep until</span>
                      <span className={styles.propertyValue}>
                        <RelativeTime iso={row.retainUntil} mode="date" />
                      </span>
                    </div>
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>
                        Contribution ID
                      </span>
                      <span className={styles.propertyValue}>
                        <IdChip value={row.id} label="contribution" />
                      </span>
                    </div>
                    {row.marketReport ? (
                      <>
                        <div className={styles.propertyRow}>
                          <span className={styles.propertyLabel}>
                            Market ID
                          </span>
                          <span className={styles.propertyValue}>
                            <IdChip
                              value={row.marketReport.marketId}
                              label="market"
                            />
                          </span>
                        </div>
                        <div className={styles.propertyRow}>
                          <span className={styles.propertyLabel}>
                            Location ID
                          </span>
                          <span className={styles.propertyValue}>
                            <IdChip
                              value={row.marketReport.retailerLocationId}
                              label="location"
                            />
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </details>
              </div>

              <div className={contributionStyles.decisionStack}>
                {row.parentModerationStatus === "pending" ? (
                  canDecide ? (
                    <form
                      data-item-id={row.id}
                      className={styles.decideSection}
                      action={formAction}
                    >
                      <h3 className={styles.sectionLabel}>
                        Contribution decision
                      </h3>
                      {actionState &&
                      !actionState.ok &&
                      actionState.targetId === row.id ? (
                        <p
                          role="alert"
                          className={`${styles.permissionNote} ${contributionStyles.errorNote}`}
                        >
                          {actionState.error}
                        </p>
                      ) : null}
                      <input type="hidden" name="targetId" value={row.id} />
                      <div className={styles.decideField}>
                        <label
                          htmlFor={`rationale-${row.id}`}
                          className={styles.decideNoteLabel}
                        >
                          Note
                        </label>
                        <textarea
                          id={`rationale-${row.id}`}
                          className={styles.note}
                          name="rationale"
                          placeholder="Optional note"
                          disabled={isPending}
                        />
                      </div>
                      {rejectConfirmId === row.id ? (
                        <div
                          className={contributionStyles.rejectConfirmation}
                          id={confirmationId}
                        >
                          <div>
                            <strong>Reject this submission?</strong>
                            {row.pendingLinkedReportCount > 0 ? (
                              /* prettier-ignore */
                              <span>
                                {row.pendingLinkedReportCount} linked {
                                  row.pendingLinkedReportCount === 1 ? 'report' : 'reports'
                                } will also be rejected.
                              </span>
                            ) : null}
                          </div>
                          <div
                            className={styles.actionButtons}
                            data-ops-decision-actions
                          >
                            <button
                              className={styles.btn}
                              type="button"
                              disabled={isPending}
                              onClick={() => setRejectConfirmId(null)}
                            >
                              Keep
                            </button>
                            <button
                              className={`${styles.btn} ${styles.btnReject}`}
                              type="submit"
                              name="decision"
                              value="reject"
                              aria-describedby={confirmationId}
                              disabled={isPending}
                              onClick={() => {
                                pendingDecisionRef.current = "reject";
                              }}
                            >
                              {isPending &&
                              pendingDecisionRef.current === "reject"
                                ? "Rejecting…"
                                : "Reject"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={styles.actionButtons}
                          data-ops-decision-actions
                        >
                          <button
                            className={`${styles.btn} ${styles.btnReject}`}
                            type="button"
                            disabled={isPending}
                            onClick={() => setRejectConfirmId(row.id)}
                          >
                            Reject
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnApprove}`}
                            type="submit"
                            name="decision"
                            value="approve"
                            disabled={isPending}
                            onClick={() => {
                              pendingDecisionRef.current = "approve";
                            }}
                          >
                            {isPending &&
                            pendingDecisionRef.current === "approve"
                              ? "Approving…"
                              : "Approve"}
                          </button>
                        </div>
                      )}
                    </form>
                  ) : (
                    <p className={styles.permissionNote}>
                      You cannot make decisions on contributions.
                    </p>
                  )
                ) : null}

                {row.marketReport?.moderationStatus === "pending" ? (
                  row.parentModerationStatus !== "approved" ? (
                    <p className={styles.permissionNote}>
                      Decide the parent contribution before reviewing its Market
                      Finder report.
                    </p>
                  ) : canDecideMarketReports ? (
                    <form
                      data-item-id={row.id}
                      className={styles.decideSection}
                      action={marketFormAction}
                    >
                      <h3 className={styles.sectionLabel}>
                        Market report decision
                      </h3>
                      <p className={contributionStyles.decisionBoundary}>
                        This decision classifies the report only. It does not
                        update the shop, directions, price, or stock.
                      </p>
                      {marketActionState &&
                      !marketActionState.ok &&
                      marketActionState.targetId === row.id ? (
                        <p
                          role="alert"
                          className={`${styles.permissionNote} ${contributionStyles.errorNote}`}
                        >
                          {marketActionState.error}
                        </p>
                      ) : null}
                      <input
                        type="hidden"
                        name="contributionId"
                        value={row.id}
                      />
                      <div className={styles.decideField}>
                        <label
                          htmlFor={`market-rationale-${row.id}`}
                          className={styles.decideNoteLabel}
                        >
                          Review reason
                        </label>
                        <textarea
                          id={`market-rationale-${row.id}`}
                          className={styles.note}
                          name="rationale"
                          placeholder="State the evidence for this report decision"
                          required
                          minLength={1}
                          maxLength={2000}
                          disabled={isMarketPending}
                        />
                      </div>
                      <div
                        className={styles.actionButtons}
                        data-ops-decision-actions
                      >
                        <button
                          className={`${styles.btn} ${styles.btnReject}`}
                          type="submit"
                          name="decision"
                          value="reject"
                          disabled={isMarketPending}
                          onClick={() => {
                            pendingMarketDecisionRef.current = "reject";
                          }}
                        >
                          {isMarketPending &&
                          pendingMarketDecisionRef.current === "reject"
                            ? "Rejecting…"
                            : "Reject report"}
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnApprove}`}
                          type="submit"
                          name="decision"
                          value="approve"
                          disabled={isMarketPending}
                          onClick={() => {
                            pendingMarketDecisionRef.current = "approve";
                          }}
                        >
                          {isMarketPending &&
                          pendingMarketDecisionRef.current === "approve"
                            ? "Approving…"
                            : "Approve report"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className={styles.permissionNote}>
                      You cannot decide Market Finder reports.
                    </p>
                  )
                ) : null}
              </div>
            </div>
          );
        }}
      />
      {queueState.hasMore ? (
        <div ref={loadSentinelRef} className={contributionStyles.loadMore}>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={queueState.isLoading}
          >
            {queueState.isLoading
              ? "Loading…"
              : queueState.loadError
                ? "Try again"
                : "Load more"}
          </button>
          {queueState.loadError ? (
            <span role="alert">{queueState.loadError}</span>
          ) : queueState.isLoading ? (
            <span role="status" aria-live="polite">
              Loading more contributions.
            </span>
          ) : null}
        </div>
      ) : null}
      <DecisionAnnouncement message={visibleDecisionAnnouncement} />
    </>
  );
}
