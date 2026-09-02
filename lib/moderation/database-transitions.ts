import type { Sql } from "postgres";
import {
  buildModerationAuditRow,
  marketFinderReportDecisionInputSchema,
  physicalProductEvidenceInputSchema,
  physicalProductObservationDecisionInputSchema,
  type MarketFinderReportOutcome,
  type ModerationAction,
  type ModerationQueue,
  type PhysicalEvidenceSourceMethod,
  type PhysicalProductEvidenceInput,
} from "./schema";

type Decision = Extract<ModerationAction["action"], "approve" | "reject">;
type ActionMetadata = ModerationAction["metadata"];
type TransactionBegin = <T>(
  optionsOrRun: string | ((tx: Sql) => Promise<T>),
  run?: (tx: Sql) => Promise<T>,
) => Promise<T>;
type TransactionCapableSql = Sql & {
  begin?: TransactionBegin;
};

export type ContributionModerationStatus =
  "pending" | "mapped" | "approved" | "rejected";
export type MarketFinderReportModerationStatus =
  "pending" | "mapped" | "approved" | "rejected";
export type PhysicalProductObservationModerationStatus =
  "pending" | "approved" | "rejected" | "superseded";

export function planMarketFinderReportDecision(input: {
  contributionId: string;
  reportContributionId: string;
  parentStatus: ContributionModerationStatus;
  parentRetained: boolean;
  reportStatus: MarketFinderReportModerationStatus;
  decision: Decision;
}) {
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new Error("Unsupported Market Finder report decision.");
  }
  if (input.contributionId !== input.reportContributionId) {
    throw new Error(
      "The Market Finder report does not match its parent contribution.",
    );
  }
  if (!input.parentRetained) {
    throw new Error(
      "An expired parent contribution cannot decide a Market Finder report.",
    );
  }
  if (input.parentStatus !== "approved") {
    throw new Error(
      "Approve the parent contribution before deciding its Market Finder report.",
    );
  }
  if (input.reportStatus !== "pending") {
    throw new Error("The Market Finder report is already settled.");
  }
  return {
    contributionId: input.contributionId,
    previousStatus: input.reportStatus,
    nextStatus:
      input.decision === "approve"
        ? ("approved" as const)
        : ("rejected" as const),
    decision: input.decision,
  };
}

export function planPhysicalProductObservationDecision(input: {
  observationId: string;
  status: PhysicalProductObservationModerationStatus;
  decision: Decision;
}) {
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new Error("Unsupported physical observation decision.");
  }
  if (input.status !== "pending") {
    throw new Error("The physical product observation is already settled.");
  }
  return {
    observationId: input.observationId,
    previousStatus: input.status,
    nextStatus:
      input.decision === "approve"
        ? ("approved" as const)
        : ("rejected" as const),
    decision: input.decision,
  };
}

export type ResearchAssignmentAction =
  "claim" | "defer" | "retry" | "assign" | "unassign";
type ResearchAssignmentTask = {
  status: "pending" | "in-progress" | "completed" | "dismissed";
  workState: "ready" | "assigned" | "blocked" | "retry";
  assignedOperatorId: string | null;
  signalCount: number;
};
type ResearchAssignmentOperator = {
  id: string;
  role: "moderator" | "operator" | "admin";
};

export type ObservationCorrectionDisposition = "defer" | "reject";
export type ObservationModerationStatus =
  "pending" | "mapped" | "approved" | "rejected";
export type ObservationCorrectionPlan = {
  id: string;
  previousStatus: Extract<ObservationModerationStatus, "approved" | "rejected">;
  nextStatus: Extract<ObservationModerationStatus, "pending" | "rejected">;
  previousDecisionAuditId: string;
  auditAction: ObservationCorrectionDisposition;
};
export type ObservationCausalAuditEvent = {
  id: string;
  eventSequence: string;
  action: "approve" | "reject" | "defer";
  metadata: Record<string, unknown>;
};

export function observationStatusFromAuditEvent(
  event: ObservationCausalAuditEvent,
): Extract<ObservationModerationStatus, "pending" | "approved" | "rejected"> {
  const hasCorrectionMarker = Object.prototype.hasOwnProperty.call(
    event.metadata,
    "correction",
  );
  if (event.action === "approve") {
    if (hasCorrectionMarker) {
      throw new Error(
        "An approve audit cannot be an observation correction state event.",
      );
    }
    return "approved";
  }
  const isCorrection = event.metadata.correction === true;
  if (event.action === "defer") {
    if (!isCorrection || event.metadata.nextStatus !== "pending") {
      throw new Error(
        "The latest observation defer audit is not a valid correction state event.",
      );
    }
    return "pending";
  }
  if (hasCorrectionMarker && !isCorrection) {
    throw new Error(
      "The latest observation reject audit has an invalid correction marker.",
    );
  }
  if (!isCorrection) return "rejected";
  if (event.metadata.nextStatus !== "rejected") {
    throw new Error(
      "The latest observation reject correction has invalid state metadata.",
    );
  }
  return "rejected";
}

export function planObservationCorrection(
  id: string,
  previousStatus: ObservationModerationStatus,
  disposition: ObservationCorrectionDisposition,
  previousDecisionAuditId: string,
): ObservationCorrectionPlan {
  if (disposition !== "defer" && disposition !== "reject") {
    throw new Error("Unsupported observation correction disposition.");
  }
  if (previousStatus === "pending") {
    throw new Error(
      "A pending observation has no settled decision to correct.",
    );
  }
  if (previousStatus === "mapped") {
    throw new Error(
      "Mapped observations are not supported by the correction pathway.",
    );
  }

  const nextStatus =
    disposition === "defer" ? ("pending" as const) : ("rejected" as const);
  if (previousStatus === nextStatus) {
    throw new Error(
      "The requested observation correction would not change its status.",
    );
  }
  if (!previousDecisionAuditId) {
    throw new Error("The prior observation decision audit entry is required.");
  }

  return {
    id,
    previousStatus,
    nextStatus,
    previousDecisionAuditId,
    auditAction: disposition,
  };
}

export function planResearchAssignmentTransition(input: {
  action: ResearchAssignmentAction;
  task: ResearchAssignmentTask;
  operator: ResearchAssignmentOperator;
  targetOperator?: ResearchAssignmentOperator;
  allowTakeover?: boolean;
}) {
  const { action, task, operator } = input;
  if (operator.role === "moderator") {
    throw new Error("Research assignment requires an operator or admin.");
  }
  if (task.status !== "pending" && task.status !== "in-progress") {
    throw new Error("A terminal research task cannot be reassigned.");
  }
  if (task.signalCount <= 0 && action !== "unassign") {
    throw new Error(
      "Research work without an active report cannot be assigned or resolved.",
    );
  }

  if (action === "assign") {
    if (operator.role !== "admin") {
      throw new Error(
        "Only an admin may assign research work to another operator.",
      );
    }
    if (!input.targetOperator || input.targetOperator.role === "moderator") {
      throw new Error("Choose an active research operator or admin.");
    }
    if (task.assignedOperatorId === input.targetOperator.id) {
      throw new Error("Research work is already assigned to that operator.");
    }
    return {
      status: "in-progress" as const,
      workState: "assigned" as const,
      takeover: task.assignedOperatorId !== null,
      assignmentOperation:
        task.assignedOperatorId === null
          ? ("assign" as const)
          : ("reassign" as const),
      previousOwnerId: task.assignedOperatorId,
      previousWorkState: task.workState,
      newOwnerId: input.targetOperator.id,
    };
  }

  if (action === "unassign") {
    if (operator.role !== "admin") {
      throw new Error("Only an admin may unassign research work.");
    }
    if (task.status !== "in-progress" || task.assignedOperatorId === null) {
      throw new Error("Only assigned research work can be unassigned.");
    }
    return {
      status: "pending" as const,
      workState: "ready" as const,
      takeover: false,
      assignmentOperation: "unassign" as const,
      previousOwnerId: task.assignedOperatorId,
      previousWorkState: task.workState,
      newOwnerId: null,
    };
  }

  const takeover = input.allowTakeover === true;
  if (takeover) {
    if (operator.role !== "admin") {
      throw new Error("Only an admin may take over assigned research work.");
    }
    if (
      task.status !== "in-progress" ||
      task.assignedOperatorId === null ||
      task.assignedOperatorId === operator.id
    ) {
      throw new Error("A takeover requires work owned by another operator.");
    }
  } else if (
    task.assignedOperatorId !== null &&
    task.assignedOperatorId !== operator.id
  ) {
    throw new Error("The research task is owned by another operator.");
  }

  if (
    action === "retry" &&
    (task.status !== "in-progress" ||
      task.assignedOperatorId !== operator.id ||
      !["assigned", "blocked", "retry"].includes(task.workState))
  ) {
    throw new Error("Only the current owner may retry active research work.");
  }

  const workState =
    action === "defer"
      ? ("blocked" as const)
      : action === "retry"
        ? ("retry" as const)
        : ("assigned" as const);
  return {
    status: "in-progress" as const,
    workState,
    takeover,
    assignmentOperation: takeover ? ("takeover" as const) : action,
    previousOwnerId: task.assignedOperatorId,
    previousWorkState: task.workState,
    newOwnerId: operator.id,
  };
}

async function validateResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  options: { allowResearchTakeover?: boolean; targetOperatorId?: string },
  lockTask: boolean,
) {
  const operatorLock = lockTask ? sql`for share` : sql``;
  const [operator] = await sql<ResearchAssignmentOperator[]>`
    select id, role
    from moderation_operators
    where auth_subject = ${operatorSubject} and active = true
    limit 1
    ${operatorLock}
  `;
  if (!operator)
    throw new Error("An active operator is required to assign research work.");

  const [targetOperator] =
    action === "assign"
      ? await sql<ResearchAssignmentOperator[]>`
        select id, role
        from moderation_operators
        where id = ${options.targetOperatorId ?? null}
          and active = true
          and role in ('operator', 'admin')
        limit 1
        ${operatorLock}
      `
      : [];

  const lock = lockTask ? sql`for update` : sql``;
  const [task] = await sql<
    {
      status: ResearchAssignmentTask["status"];
      work_state: ResearchAssignmentTask["workState"];
      assigned_operator_id: string | null;
      signal_count: number;
    }[]
  >`
    select status, work_state, assigned_operator_id, signal_count
    from community_research_tasks
    where id = ${targetRef}
    ${lock}
  `;
  if (!task) throw new Error("Moderation target does not exist.");
  return planResearchAssignmentTransition({
    action,
    operator,
    task: {
      status: task.status,
      workState: task.work_state,
      assignedOperatorId: task.assigned_operator_id,
      signalCount: task.signal_count,
    },
    targetOperator,
    allowTakeover: options.allowResearchTakeover,
  });
}

export function preflightResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  options: { allowResearchTakeover?: boolean; targetOperatorId?: string } = {},
) {
  return validateResearchAssignment(
    sql,
    operatorSubject,
    targetRef,
    action,
    options,
    false,
  );
}

export async function updateResearchAssignment(
  sql: Sql,
  operatorSubject: string,
  targetRef: string,
  action: ResearchAssignmentAction,
  rationale: string,
  options: { allowResearchTakeover?: boolean; targetOperatorId?: string } = {},
): Promise<void> {
  await inTransaction(sql, async (tx) => {
    const planned = await validateResearchAssignment(
      tx,
      operatorSubject,
      targetRef,
      action,
      options,
      true,
    );
    const updated = await tx<{ id: string }[]>`
      update community_research_tasks
      set
        status = ${planned.status},
        assigned_operator_id = ${planned.newOwnerId},
        work_state = ${planned.workState},
        next_action = ${planned.workState === "ready" ? null : rationale},
        last_reviewed_at = now(),
        updated_at = now()
      where id = ${targetRef}
      returning id
    `;
    if (!updated[0]) throw new Error("The research task could not be updated.");

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "community_research_task",
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata: {
        assignmentOperation: planned.assignmentOperation,
        workState: planned.workState,
        takeover: planned.takeover,
        previousOwnerId: planned.previousOwnerId,
        previousWorkState: planned.previousWorkState,
        newOwnerId: planned.newOwnerId,
      },
    });
  });
}

// This module intentionally has no `server-only` marker: the authenticated Next
// writers and the private command-line operator share these exact database
// transitions. Browser-facing code imports `transitions.ts`, whose server-only
// boundary remains intact.

async function inTransaction<T>(
  sql: Sql,
  run: (tx: Sql) => Promise<T>,
): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  return typeof begin === "function"
    ? await (begin.call(sql, run) as Promise<T>)
    : run(sql);
}

async function inRequiredTransaction<T>(
  sql: Sql,
  run: (tx: Sql) => Promise<T>,
): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  if (typeof begin !== "function") {
    throw new Error(
      "This moderation action requires transactional database access.",
    );
  }
  return await (begin.call(sql, run) as Promise<T>);
}

async function inRequiredReadOnlyTransaction<T>(
  sql: Sql,
  run: (tx: Sql) => Promise<T>,
): Promise<T> {
  const begin = (sql as TransactionCapableSql).begin;
  if (typeof begin !== "function") {
    throw new Error(
      "This moderation preflight requires transactional database access.",
    );
  }
  return await (begin.call(sql, "read only", run) as Promise<T>);
}

export async function recordModerationAction(
  sql: Sql,
  input: ModerationAction,
): Promise<void> {
  const row = buildModerationAuditRow(input);
  await sql`
    insert into moderation_audit_log (
      operator_subject, queue, action, target_ref, canonical_write, rationale, metadata
    ) values (
      ${row.operatorSubject}, ${row.queue}, ${row.action}, ${row.targetRef},
      ${row.canonicalWrite}, ${row.rationale}, ${sql.json(row.metadata)}
    )
  `;
}

async function transition(
  sql: Sql,
  queue: ModerationQueue,
  action: ModerationAction["action"],
  operatorSubject: string,
  targetRef: string,
  rationale: string | null,
  runUpdate: (tx: Sql) => Promise<{ id: string }[]>,
  metadata: ActionMetadata = {},
): Promise<string | null> {
  return inTransaction(sql, async (tx) => {
    const rows = await runUpdate(tx);
    if (rows.length === 0) return null;
    await recordModerationAction(tx, {
      operatorSubject,
      queue,
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata,
    });
    return rows[0].id;
  });
}

async function reconcileTasksForContribution(
  sql: Sql,
  contributionId: string,
): Promise<number> {
  const [row] = await sql<{ updated_count: number }[]>`
    with affected as (
      select distinct task_id
      from community_research_task_mentions
      where contribution_id = ${contributionId}
    ),
    contribution_signals as (
      select
        mention.task_id,
        count(distinct mention.contribution_id)::integer as signal_count,
        min(contribution.submitted_at) as first_seen_at,
        max(contribution.submitted_at) as last_seen_at
      from community_research_task_mentions mention
      join community_contributions contribution on contribution.id = mention.contribution_id
      join affected on affected.task_id = mention.task_id
      where contribution.moderation_status <> 'rejected'
        and contribution.retain_until > now()
      group by mention.task_id
    ),
    request_signals as (
      select
        request_mention.task_id,
        count(*)::integer as signal_count,
        min(request_mention.first_seen_at) as first_seen_at,
        max(request_mention.last_seen_at) as last_seen_at
      from customer_product_request_research_mentions request_mention
      join affected on affected.task_id = request_mention.task_id
      where request_mention.active
      group by request_mention.task_id
    ),
    active_signals as (
      select
        affected.task_id,
        coalesce(contribution_signals.signal_count, 0)
          + coalesce(request_signals.signal_count, 0) as signal_count,
        coalesce(
          least(contribution_signals.first_seen_at, request_signals.first_seen_at),
          contribution_signals.first_seen_at,
          request_signals.first_seen_at
        ) as first_seen_at,
        coalesce(
          greatest(contribution_signals.last_seen_at, request_signals.last_seen_at),
          contribution_signals.last_seen_at,
          request_signals.last_seen_at
        ) as last_seen_at
      from affected
      left join contribution_signals
        on contribution_signals.task_id = affected.task_id
      left join request_signals on request_signals.task_id = affected.task_id
    ),
    updated as (
      update community_research_tasks task
      set
        signal_count = coalesce(active_signals.signal_count, 0),
        first_seen_at = coalesce(active_signals.first_seen_at, task.first_seen_at),
        last_seen_at = coalesce(active_signals.last_seen_at, task.last_seen_at),
        updated_at = now()
      from active_signals
      where task.id = active_signals.task_id
      returning task.id
    )
    select count(*)::integer as updated_count from updated
  `;
  return row?.updated_count ?? 0;
}

export async function decideContribution(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === "approve" ? "approved" : "rejected";
  return inRequiredTransaction(sql, async (tx) => {
    const [parent] = await tx<
      { id: string; moderation_status: ContributionModerationStatus }[]
    >`
      select id, moderation_status
      from community_contributions
      where id = ${id}
      for update
    `;
    if (!parent || parent.moderation_status !== "pending") return null;

    let cascadedMarketFinderReports = 0;
    if (decision === "reject") {
      const [schema] = await tx<{ available: boolean }[]>`
        select to_regclass('public.market_finder_reports') is not null as available
      `;
      if (schema?.available) {
        const pendingReports = await tx<{ contribution_id: string }[]>`
          select contribution_id
          from market_finder_reports
          where contribution_id = ${id}
            and moderation_status = 'pending'
          for update
        `;
        cascadedMarketFinderReports = pendingReports.length;
      }
    }

    const rows = await tx<{ id: string }[]>`
      update community_contributions
      set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending'
      returning id
    `;
    if (rows.length === 0) return null;

    let cascadedEdges = 0;
    let cascadedObservations = 0;
    let reconciledResearchTasks = 0;
    if (decision === "reject") {
      const rejectedEdges = await tx<{ id: string }[]>`
        update community_knowledge_edges
        set moderation_status = 'rejected'
        where contribution_id = ${id} and moderation_status = 'pending'
        returning id
      `;
      const rejectedObservations = await tx<{ id: string }[]>`
        update community_observations
        set moderation_status = 'rejected'
        where contribution_id = ${id} and moderation_status = 'pending'
        returning id
      `;
      cascadedEdges = rejectedEdges.length;
      cascadedObservations = rejectedObservations.length;
      reconciledResearchTasks = await reconcileTasksForContribution(tx, id);
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "community_contribution",
      action: decision,
      targetRef: id,
      canonicalWrite: false,
      rationale,
      metadata:
        decision === "reject"
          ? {
              cascadedEdges,
              cascadedObservations,
              cascadedMarketFinderReports,
              marketFinderReportCascade:
                cascadedMarketFinderReports > 0 ? "database_trigger" : null,
              reconciledResearchTasks,
            }
          : {},
    });
    return rows[0].id;
  });
}

export async function decideMarketFinderReport(
  sql: Sql,
  operatorSubject: string,
  contributionId: string,
  decision: Decision,
  rationale: string,
) {
  const input = marketFinderReportDecisionInputSchema.parse({
    contributionId,
    decision,
    rationale,
  });
  return inRequiredTransaction(sql, async (tx) => {
    const [parent] = await tx<
      {
        id: string;
        moderation_status: ContributionModerationStatus;
        retained: boolean;
      }[]
    >`
      select id, moderation_status, (retain_until > now()) as retained
      from community_contributions
      where id = ${input.contributionId}
      for update
    `;
    if (!parent) throw new Error("The parent contribution does not exist.");

    const [report] = await tx<
      {
        contribution_id: string;
        market_id: string;
        retailer_location_id: string;
        product_identity_version_id: string;
        outcome: MarketFinderReportOutcome;
        moderation_status: MarketFinderReportModerationStatus;
      }[]
    >`
      select contribution_id, market_id, retailer_location_id,
             product_identity_version_id, outcome, moderation_status
      from market_finder_reports
      where contribution_id = ${input.contributionId}
      for update
    `;
    if (!report) throw new Error("The Market Finder report does not exist.");

    const planned = planMarketFinderReportDecision({
      contributionId: parent.id,
      reportContributionId: report.contribution_id,
      parentStatus: parent.moderation_status,
      parentRetained: parent.retained,
      reportStatus: report.moderation_status,
      decision: input.decision,
    });
    const [updated] = await tx<{ contribution_id: string }[]>`
      update market_finder_reports
      set moderation_status = ${planned.nextStatus},
          reviewed_by = ${operatorSubject},
          reviewed_at = now()
      where contribution_id = ${input.contributionId}
        and moderation_status = 'pending'
      returning contribution_id
    `;
    if (!updated) {
      throw new Error(
        "The Market Finder report changed before the decision could be saved.",
      );
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "market_finder_report",
      action: input.decision,
      targetRef: input.contributionId,
      canonicalWrite: false,
      rationale: input.rationale,
      metadata: {
        parentContributionId: parent.id,
        marketId: report.market_id,
        retailerLocationId: report.retailer_location_id,
        productIdentityVersionId: report.product_identity_version_id,
        outcome: report.outcome,
        previousStatus: planned.previousStatus,
        nextStatus: planned.nextStatus,
      },
    });
    return updated.contribution_id;
  });
}

type PhysicalEvidenceParent = {
  id: string;
  moderation_status: ContributionModerationStatus;
  retained: boolean;
};

type PhysicalEvidenceReport = {
  contribution_id: string;
  market_id: string;
  retailer_location_id: string;
  product_identity_version_id: string;
  outcome: MarketFinderReportOutcome;
  moderation_status: MarketFinderReportModerationStatus;
  location_state: "lead" | "verified" | "disputed" | "retired";
  identity_state: "active" | "merged" | "retired" | "superseded";
  product_published: boolean;
};

type PhysicalObservationDecisionRow = {
  id: string;
  retailer_location_id: string;
  product_identity_version_id: string;
  moderation_status: PhysicalProductObservationModerationStatus;
  source_method: PhysicalEvidenceSourceMethod;
  observed_at: Date | string;
  expires_at: Date | string;
  location_state: "lead" | "verified" | "disputed" | "retired";
  location_current: boolean;
  identity_state: "active" | "merged" | "retired" | "superseded";
  product_published: boolean;
  market_slug: string | null;
};

function parseCurrentPhysicalEvidence(rawInput: PhysicalProductEvidenceInput) {
  const input = physicalProductEvidenceInputSchema.parse(rawInput);
  if (Date.parse(input.observedAt) > Date.now()) {
    throw new Error("Physical evidence cannot be observed in the future.");
  }
  if (Date.parse(input.expiresAt) <= Date.now()) {
    throw new Error(
      "Physical evidence must still be current when it is recorded.",
    );
  }
  return input;
}

async function requireActivePhysicalEvidenceAdmin(
  sql: Sql,
  operatorSubject: string,
  lock: boolean,
) {
  const rows = lock
    ? await sql<{ id: string; role: "moderator" | "operator" | "admin" }[]>`
        select id, role
        from moderation_operators
        where auth_subject = ${operatorSubject}
          and active = true
        limit 1
        for share
      `
    : await sql<{ id: string; role: "moderator" | "operator" | "admin" }[]>`
        select id, role
        from moderation_operators
        where auth_subject = ${operatorSubject}
          and active = true
        limit 1
      `;
  if (!rows[0] || rows[0].role !== "admin") {
    throw new Error(
      "Only an active admin may manage physical product evidence.",
    );
  }
  return rows[0];
}

async function validatePhysicalEvidenceContext(
  sql: Sql,
  operatorSubject: string,
  input: PhysicalProductEvidenceInput,
  lock: boolean,
) {
  await requireActivePhysicalEvidenceAdmin(sql, operatorSubject, lock);
  const parentRows = lock
    ? await sql<PhysicalEvidenceParent[]>`
        select id, moderation_status, (retain_until > now()) as retained
        from community_contributions
        where id = ${input.contributionId}
        for share
      `
    : await sql<PhysicalEvidenceParent[]>`
        select id, moderation_status, (retain_until > now()) as retained
        from community_contributions
        where id = ${input.contributionId}
      `;
  const parent = parentRows[0];
  if (!parent) throw new Error("The parent contribution does not exist.");
  if (!parent.retained || parent.moderation_status !== "approved") {
    throw new Error(
      "Physical evidence requires a retained, approved parent contribution.",
    );
  }

  const reportRows = lock
    ? await sql<PhysicalEvidenceReport[]>`
        select
          report.contribution_id,
          report.market_id,
          report.retailer_location_id,
          report.product_identity_version_id,
          report.outcome,
          report.moderation_status,
          location.location_state as location_state,
          identity.lifecycle_state as identity_state,
          product.is_published as product_published
        from market_finder_reports report
        join retailer_locations location on location.id = report.retailer_location_id
        join catalogue_product_identity_versions identity
          on identity.identity_version_id = report.product_identity_version_id
        join products product on product.id = identity.product_id
        where report.contribution_id = ${input.contributionId}
        for share of report, location, identity, product
      `
    : await sql<PhysicalEvidenceReport[]>`
        select
          report.contribution_id,
          report.market_id,
          report.retailer_location_id,
          report.product_identity_version_id,
          report.outcome,
          report.moderation_status,
          location.location_state as location_state,
          identity.lifecycle_state as identity_state,
          product.is_published as product_published
        from market_finder_reports report
        join retailer_locations location on location.id = report.retailer_location_id
        join catalogue_product_identity_versions identity
          on identity.identity_version_id = report.product_identity_version_id
        join products product on product.id = identity.product_id
        where report.contribution_id = ${input.contributionId}
      `;
  const report = reportRows[0];
  if (!report || report.contribution_id !== parent.id) {
    throw new Error(
      "The Market Finder report does not match its parent contribution.",
    );
  }
  if (report.moderation_status !== "approved") {
    throw new Error(
      "Approve the Market Finder report before recording physical evidence.",
    );
  }
  if (!["found_bought", "shop_exists_no_stock"].includes(report.outcome)) {
    throw new Error(
      "This Market Finder outcome does not support a product-at-location observation.",
    );
  }
  if (report.location_state === "retired") {
    throw new Error(
      "A retired retailer location cannot receive physical product evidence.",
    );
  }
  if (report.identity_state !== "active" || !report.product_published) {
    throw new Error(
      "Physical evidence requires a current published exact product identity.",
    );
  }
  return { parent, report };
}

export function preflightPhysicalProductObservation(
  sql: Sql,
  operatorSubject: string,
  rawInput: PhysicalProductEvidenceInput,
) {
  const input = parseCurrentPhysicalEvidence(rawInput);
  return inRequiredReadOnlyTransaction(sql, async (tx) => {
    const { parent, report } = await validatePhysicalEvidenceContext(
      tx,
      operatorSubject,
      input,
      false,
    );
    return {
      contributionId: parent.id,
      marketId: report.market_id,
      retailerLocationId: report.retailer_location_id,
      productIdentityVersionId: report.product_identity_version_id,
    };
  });
}

export async function createPhysicalProductObservation(
  sql: Sql,
  operatorSubject: string,
  rawInput: PhysicalProductEvidenceInput,
) {
  const input = parseCurrentPhysicalEvidence(rawInput);
  return inRequiredTransaction(sql, async (tx) => {
    const { parent, report } = await validatePhysicalEvidenceContext(
      tx,
      operatorSubject,
      input,
      true,
    );
    const [observation] = await tx<{ id: string }[]>`
      insert into physical_product_observations (
        retailer_location_id,
        product_identity_version_id,
        availability,
        price_ngn,
        observed_at,
        expires_at,
        source_method,
        source_reference,
        observed_title,
        observed_size,
        moderation_status
      ) values (
        ${report.retailer_location_id},
        ${report.product_identity_version_id},
        ${input.availability},
        ${input.priceNgn},
        ${input.observedAt}::timestamptz,
        ${input.expiresAt}::timestamptz,
        ${input.sourceMethod},
        ${input.sourceReference},
        ${input.observedTitle},
        ${input.observedSize},
        'pending'
      )
      returning id
    `;
    if (!observation)
      throw new Error("The physical observation could not be recorded.");

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "physical_product_observation",
      action: "promote",
      targetRef: observation.id,
      canonicalWrite: true,
      rationale: input.rationale,
      metadata: {
        operation: "append_pending_evidence",
        parentContributionId: parent.id,
        marketId: report.market_id,
        retailerLocationId: report.retailer_location_id,
        productIdentityVersionId: report.product_identity_version_id,
        reportOutcome: report.outcome,
        availability: input.availability,
        priceNgn: input.priceNgn,
        observedAt: input.observedAt,
        expiresAt: input.expiresAt,
        sourceMethod: input.sourceMethod,
        sourceReference: input.sourceReference,
      },
    });
    return observation.id;
  });
}

async function readPhysicalObservationDecisionTarget(
  sql: Sql,
  observationId: string,
  lock: boolean,
) {
  const rows = lock
    ? await sql<PhysicalObservationDecisionRow[]>`
        select
          observation.id,
          observation.retailer_location_id,
          observation.product_identity_version_id,
          observation.moderation_status,
          observation.source_method,
          observation.observed_at,
          observation.expires_at,
          location.location_state,
          (location.verification_expires_at > now()) as location_current,
          identity.lifecycle_state as identity_state,
          product.is_published as product_published,
          market.slug as market_slug
        from physical_product_observations observation
        join retailer_locations location on location.id = observation.retailer_location_id
        left join physical_markets market on market.id = location.market_id
        join catalogue_product_identity_versions identity
          on identity.identity_version_id = observation.product_identity_version_id
        join products product on product.id = identity.product_id
        where observation.id = ${observationId}
        for update of observation
      `
    : await sql<PhysicalObservationDecisionRow[]>`
        select
          observation.id,
          observation.retailer_location_id,
          observation.product_identity_version_id,
          observation.moderation_status,
          observation.source_method,
          observation.observed_at,
          observation.expires_at,
          location.location_state,
          (location.verification_expires_at > now()) as location_current,
          identity.lifecycle_state as identity_state,
          product.is_published as product_published,
          market.slug as market_slug
        from physical_product_observations observation
        join retailer_locations location on location.id = observation.retailer_location_id
        left join physical_markets market on market.id = location.market_id
        join catalogue_product_identity_versions identity
          on identity.identity_version_id = observation.product_identity_version_id
        join products product on product.id = identity.product_id
        where observation.id = ${observationId}
      `;
  if (!rows[0])
    throw new Error("The physical product observation does not exist.");
  return rows[0];
}

function assertPhysicalObservationApprovalEligible(
  observation: PhysicalObservationDecisionRow,
) {
  if (
    ![
      "field_visit",
      "retailer_confirmation",
      "branch_online_record",
      "community_report",
    ].includes(observation.source_method)
  ) {
    throw new Error("Discovery-only evidence cannot be approved.");
  }
  if (
    Date.parse(String(observation.observed_at)) > Date.now() ||
    Date.parse(String(observation.expires_at)) <= Date.now()
  ) {
    throw new Error("Only current, non-future evidence can be approved.");
  }
  if (
    observation.identity_state !== "active" ||
    !observation.product_published
  ) {
    throw new Error(
      "Approval requires a current published exact product identity.",
    );
  }
  if (
    observation.location_state !== "verified" ||
    !observation.location_current
  ) {
    throw new Error("Approval requires a current verified retailer location.");
  }
}

export function preflightPhysicalProductObservationDecision(
  sql: Sql,
  operatorSubject: string,
  observationId: string,
  decision: Decision,
  rationale: string,
) {
  const input = physicalProductObservationDecisionInputSchema.parse({
    observationId,
    decision,
    rationale,
  });
  return inRequiredReadOnlyTransaction(sql, async (tx) => {
    await requireActivePhysicalEvidenceAdmin(tx, operatorSubject, false);
    const observation = await readPhysicalObservationDecisionTarget(
      tx,
      input.observationId,
      false,
    );
    const planned = planPhysicalProductObservationDecision({
      observationId: observation.id,
      status: observation.moderation_status,
      decision: input.decision,
    });
    if (planned.nextStatus === "approved") {
      assertPhysicalObservationApprovalEligible(observation);
    }
    return {
      observationId: observation.id,
      marketSlug: observation.market_slug,
      retailerLocationId: observation.retailer_location_id,
      productIdentityVersionId: observation.product_identity_version_id,
      nextStatus: planned.nextStatus,
    };
  });
}

export function decidePhysicalProductObservation(
  sql: Sql,
  operatorSubject: string,
  observationId: string,
  decision: Decision,
  rationale: string,
) {
  const input = physicalProductObservationDecisionInputSchema.parse({
    observationId,
    decision,
    rationale,
  });
  return inRequiredTransaction(sql, async (tx) => {
    await requireActivePhysicalEvidenceAdmin(tx, operatorSubject, true);
    const observation = await readPhysicalObservationDecisionTarget(
      tx,
      input.observationId,
      true,
    );
    const planned = planPhysicalProductObservationDecision({
      observationId: observation.id,
      status: observation.moderation_status,
      decision: input.decision,
    });
    if (planned.nextStatus === "approved") {
      assertPhysicalObservationApprovalEligible(observation);
    }

    const [updated] = await tx<{ id: string }[]>`
      update physical_product_observations
      set moderation_status = ${planned.nextStatus},
          reviewed_by = ${operatorSubject},
          reviewed_at = now()
      where id = ${input.observationId}
        and moderation_status = 'pending'
      returning id
    `;
    if (!updated) {
      throw new Error(
        "The physical product observation changed before the decision could be saved.",
      );
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "physical_product_observation",
      action: input.decision,
      targetRef: input.observationId,
      canonicalWrite: true,
      rationale: input.rationale,
      metadata: {
        retailerLocationId: observation.retailer_location_id,
        productIdentityVersionId: observation.product_identity_version_id,
        previousStatus: planned.previousStatus,
        nextStatus: planned.nextStatus,
        sourceMethod: observation.source_method,
      },
    });
    return {
      observationId: updated.id,
      marketSlug: observation.market_slug,
      retailerLocationId: observation.retailer_location_id,
      productIdentityVersionId: observation.product_identity_version_id,
      nextStatus: planned.nextStatus,
    };
  });
}

export function decideEdge(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === "approve" ? "approved" : "rejected";
  return transition(
    sql,
    "community_edge",
    decision,
    operatorSubject,
    id,
    rationale,
    (tx) =>
      tx<{ id: string }[]>`
      update community_knowledge_edges set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`,
  );
}

export function decideObservation(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === "approve" ? "approved" : "rejected";
  return transition(
    sql,
    "community_observation",
    decision,
    operatorSubject,
    id,
    rationale,
    (tx) =>
      tx<{ id: string }[]>`
      update community_observations set moderation_status = ${status}
      where id = ${id} and moderation_status = 'pending' returning id`,
  );
}

async function validateObservationCorrection(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: ObservationCorrectionDisposition,
  lockRows: boolean,
) {
  const operatorLock = lockRows ? sql`for share` : sql``;
  const [operator] = await sql<
    { id: string; role: "moderator" | "operator" | "admin" }[]
  >`
    select id, role
    from moderation_operators
    where auth_subject = ${operatorSubject} and active = true
    limit 1
    ${operatorLock}
  `;
  if (!operator || operator.role !== "admin") {
    throw new Error("Only an active admin may correct a settled observation.");
  }

  const parentLock = lockRows ? sql`for share` : sql``;
  const [parentContribution] =
    disposition === "defer"
      ? await sql<
          {
            id: string;
            moderation_status: ObservationModerationStatus;
            retained: boolean;
          }[]
        >`
        select contribution.id, contribution.moderation_status,
               (contribution.retain_until > now()) as retained
        from community_contributions contribution
        where contribution.id = (
          select observation.contribution_id
          from community_observations observation
          where observation.id = ${id}
        )
        ${parentLock}
      `
      : [];

  const observationLock = lockRows ? sql`for update` : sql``;
  const [observation] = await sql<
    {
      id: string;
      contribution_id: string;
      moderation_status: ObservationModerationStatus;
    }[]
  >`
    select id, contribution_id, moderation_status
    from community_observations
    where id = ${id}
    ${observationLock}
  `;
  if (!observation) throw new Error("Moderation target does not exist.");
  if (disposition === "defer") {
    if (
      !parentContribution ||
      parentContribution.id !== observation.contribution_id
    ) {
      throw new Error("The observation parent contribution is unavailable.");
    }
    if (parentContribution.moderation_status === "rejected") {
      throw new Error(
        "Correct the rejected parent contribution before reopening this observation.",
      );
    }
    if (!parentContribution.retained) {
      throw new Error(
        "An expired parent contribution cannot return an observation to review.",
      );
    }
  }

  const [previousDecision] = await sql<ObservationCausalAuditEvent[]>`
    select
      id,
      event_sequence::text as "eventSequence",
      action,
      metadata
    from moderation_audit_log
    where queue = 'community_observation'
      and target_ref = ${id}
      and (
        action in ('approve', 'reject')
        or (action = 'defer' and metadata ->> 'correction' = 'true')
      )
    order by event_sequence desc
    limit 1
  `;
  if (!previousDecision) {
    throw new Error("The prior observation decision audit entry is required.");
  }
  const auditedStatus = observationStatusFromAuditEvent(previousDecision);
  if (auditedStatus !== observation.moderation_status) {
    throw new Error(
      "The observation status does not match its latest causal audit event.",
    );
  }

  return planObservationCorrection(
    observation.id,
    observation.moderation_status,
    disposition,
    previousDecision.id,
  );
}

export function preflightObservationCorrection(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: ObservationCorrectionDisposition,
) {
  return validateObservationCorrection(
    sql,
    operatorSubject,
    id,
    disposition,
    false,
  );
}

export async function correctObservationDecision(
  sql: Sql,
  operatorSubject: string,
  id: string,
  disposition: ObservationCorrectionDisposition,
  rationale: string,
) {
  const normalizedRationale = rationale.trim();
  if (!normalizedRationale || normalizedRationale.length > 2000) {
    throw new Error(
      "A fresh correction reason between 1 and 2,000 characters is required.",
    );
  }

  return inRequiredTransaction(sql, async (tx) => {
    const planned = await validateObservationCorrection(
      tx,
      operatorSubject,
      id,
      disposition,
      true,
    );
    const [updated] = await tx<{ id: string }[]>`
      update community_observations
      set moderation_status = ${planned.nextStatus}
      where id = ${id} and moderation_status = ${planned.previousStatus}
      returning id
    `;
    if (!updated)
      throw new Error(
        "The observation decision changed before correction could be saved.",
      );

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "community_observation",
      action: planned.auditAction,
      targetRef: id,
      canonicalWrite: false,
      rationale: normalizedRationale,
      metadata: {
        correction: true,
        previousStatus: planned.previousStatus,
        nextStatus: planned.nextStatus,
        previousDecisionAuditId: planned.previousDecisionAuditId,
      },
    });
    return planned;
  });
}

export function decideModerationValue(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === "approve" ? "approved" : "rejected";
  return transition(
    sql,
    "community_moderation_value",
    decision,
    operatorSubject,
    id,
    rationale,
    (tx) =>
      tx<{ id: string }[]>`
      update community_moderation_values
      set status = ${status}, reviewed_at = now(), reviewer = ${operatorSubject}, review_note = ${rationale}
      where id = ${id} and status = 'pending' returning id`,
  );
}

export async function canonicalModerationTargetExists(
  sql: Sql,
  kind: "purpose" | "product" | "brand" | "retailer",
  ref: string,
): Promise<boolean> {
  if (kind === "purpose") {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from concerns where slug = ${ref}) as exists
    `;
    return rows[0]?.exists ?? false;
  }
  if (kind === "brand") {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from brands where slug = ${ref}) as exists
    `;
    return rows[0]?.exists ?? false;
  }
  if (kind === "retailer") {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from retailers where slug = ${ref}) as exists
    `;
    return rows[0]?.exists ?? false;
  }

  const rows = await sql<{ exists: boolean }[]>`
    select exists(
      select 1 from products where slug = ${ref} and is_published = true
    ) as exists
  `;
  if (rows[0]?.exists) return true;

  // Checked-in publication releases are also canonical public products, even
  // before their optional Neon mirror has caught up.
  const { products } = await import("@/data/catalogue");
  return products.some((product) => product.slug === ref);
}

export function mapModerationValue(
  sql: Sql,
  operatorSubject: string,
  id: string,
  canonicalEntityKind: "purpose" | "product" | "brand" | "retailer",
  canonicalEntityRef: string,
  rationale: string | null = null,
) {
  return inTransaction(sql, async (tx) => {
    if (
      !(await canonicalModerationTargetExists(
        tx,
        canonicalEntityKind,
        canonicalEntityRef,
      ))
    ) {
      throw new Error("Canonical mapping target does not exist.");
    }
    const rows = await tx<{ id: string }[]>`
      update community_moderation_values
      set status = 'mapped', canonical_entity_kind = ${canonicalEntityKind}, canonical_entity_ref = ${canonicalEntityRef},
          reviewed_at = now(), reviewer = ${operatorSubject}, review_note = ${rationale}
      where id = ${id}
        and status = 'pending'
        and value_kind = ${canonicalEntityKind}
      returning id
    `;
    if (rows.length === 0) return null;
    await recordModerationAction(tx, {
      operatorSubject,
      queue: "community_moderation_value",
      action: "map",
      targetRef: id,
      canonicalWrite: false,
      rationale,
      metadata: { canonicalEntityKind, canonicalEntityRef },
    });
    return rows[0].id;
  });
}

export function decideRetailerApplication(
  sql: Sql,
  operatorSubject: string,
  id: string,
  decision: Decision,
  rationale: string | null = null,
) {
  const status = decision === "approve" ? "approved" : "declined";
  return transition(
    sql,
    "retailer_application",
    decision,
    operatorSubject,
    id,
    rationale,
    (tx) =>
      tx<{ id: string }[]>`
      update retailer_partnership_applications set status = ${status}, updated_at = now()
      where id = ${id} and status = 'submitted' returning id`,
  );
}

export async function moderationTargetExists(
  sql: Sql,
  queue: ModerationQueue,
  targetRef: string,
): Promise<boolean> {
  const rows =
    queue === "community_contribution"
      ? await sql<
          { exists: boolean }[]
        >`select exists(select 1 from community_contributions where id::text = ${targetRef}) as exists`
      : queue === "community_edge"
        ? await sql<
            { exists: boolean }[]
          >`select exists(select 1 from community_knowledge_edges where id::text = ${targetRef}) as exists`
        : queue === "community_observation"
          ? await sql<
              { exists: boolean }[]
            >`select exists(select 1 from community_observations where id::text = ${targetRef}) as exists`
          : queue === "community_moderation_value"
            ? await sql<
                { exists: boolean }[]
              >`select exists(select 1 from community_moderation_values where id::text = ${targetRef}) as exists`
            : queue === "community_research_task"
              ? await sql<
                  { exists: boolean }[]
                >`select exists(select 1 from community_research_tasks where id::text = ${targetRef}) as exists`
              : queue === "retailer_application"
                ? await sql<
                    { exists: boolean }[]
                  >`select exists(select 1 from retailer_partnership_applications where id::text = ${targetRef}) as exists`
                : queue === "market_finder_report"
                  ? await sql<
                      { exists: boolean }[]
                    >`select exists(select 1 from market_finder_reports where contribution_id::text = ${targetRef}) as exists`
                  : queue === "retailer_location"
                    ? await sql<
                        { exists: boolean }[]
                      >`select exists(select 1 from retailer_locations where id::text = ${targetRef}) as exists`
                    : queue === "physical_product_observation"
                      ? await sql<
                          { exists: boolean }[]
                        >`select exists(select 1 from physical_product_observations where id::text = ${targetRef}) as exists`
                      : await sql<
                          { exists: boolean }[]
                        >`select exists(select 1 from commerce_events where id::text = ${targetRef}) as exists`;
  return rows[0]?.exists ?? false;
}

export async function recordNote(
  sql: Sql,
  queue: ModerationQueue,
  operatorSubject: string,
  targetRef: string,
  rationale: string,
  action: Extract<
    ModerationAction["action"],
    "note" | "defer" | "claim" | "retry"
  > = "note",
  options: { allowResearchTakeover?: boolean } = {},
): Promise<void> {
  if (queue === "community_research_task" && action !== "note") {
    await updateResearchAssignment(
      sql,
      operatorSubject,
      targetRef,
      action,
      rationale,
      options,
    );
    return;
  }
  await inTransaction(sql, async (tx) => {
    if (!(await moderationTargetExists(tx, queue, targetRef))) {
      throw new Error("Moderation target does not exist.");
    }

    await recordModerationAction(tx, {
      operatorSubject,
      queue,
      action,
      targetRef,
      canonicalWrite: false,
      rationale,
      metadata: {},
    });
  });
}

export async function reconcileCommunityResearchTasks(
  sql: Sql,
  operatorSubject: string,
  rationale: string,
): Promise<number> {
  return inTransaction(sql, async (tx) => {
    const [drift] = await tx<{ count: number }[]>`
      select count(*)::integer as count
      from community_research_tasks task
      where task.signal_count <>
        (
          select count(distinct mention.contribution_id)::integer
          from community_research_task_mentions mention
          join community_contributions contribution on contribution.id = mention.contribution_id
          where mention.task_id = task.id
            and contribution.moderation_status <> 'rejected'
            and contribution.retain_until > now()
        )
        + (
          select count(*)::integer
          from customer_product_request_research_mentions request_mention
          where request_mention.task_id = task.id
            and request_mention.active
        )
    `;
    const driftCount = drift?.count ?? 0;
    if (driftCount === 0) return 0;

    await tx`
      with contribution_signals as (
        select
          mention.task_id,
          count(distinct contribution.id)::integer as signal_count,
          min(contribution.submitted_at) as first_seen_at,
          max(contribution.submitted_at) as last_seen_at
        from community_research_task_mentions mention
        join community_contributions contribution
          on contribution.id = mention.contribution_id
        where contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
        group by mention.task_id
      ),
      request_signals as (
        select
          request_mention.task_id,
          count(*)::integer as signal_count,
          min(request_mention.first_seen_at) as first_seen_at,
          max(request_mention.last_seen_at) as last_seen_at
        from customer_product_request_research_mentions request_mention
        where request_mention.active
        group by request_mention.task_id
      ),
      active_signals as (
        select
          task.id as task_id,
          coalesce(contribution_signals.signal_count, 0)
            + coalesce(request_signals.signal_count, 0) as signal_count,
          coalesce(
            least(contribution_signals.first_seen_at, request_signals.first_seen_at),
            contribution_signals.first_seen_at,
            request_signals.first_seen_at
          ) as first_seen_at,
          coalesce(
            greatest(contribution_signals.last_seen_at, request_signals.last_seen_at),
            contribution_signals.last_seen_at,
            request_signals.last_seen_at
          ) as last_seen_at
        from community_research_tasks task
        left join contribution_signals on contribution_signals.task_id = task.id
        left join request_signals on request_signals.task_id = task.id
      )
      update community_research_tasks task
      set
        signal_count = active_signals.signal_count,
        first_seen_at = coalesce(active_signals.first_seen_at, task.first_seen_at),
        last_seen_at = coalesce(active_signals.last_seen_at, task.last_seen_at),
        updated_at = now()
      from active_signals
      where task.id = active_signals.task_id
        and task.signal_count <> active_signals.signal_count
    `;

    await recordModerationAction(tx, {
      operatorSubject,
      queue: "community_research_task",
      action: "reconcile",
      targetRef: "active-signal-counts",
      canonicalWrite: false,
      rationale,
      metadata: { reconciledTaskCount: driftCount },
    });
    return driftCount;
  });
}
