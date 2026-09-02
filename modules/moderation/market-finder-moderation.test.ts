import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { Sql } from "postgres";
import { contributionWorkItem } from "@/app/(ops)/ops/contributions/market-report-presentation";
import {
  createPhysicalProductObservation,
  decidePhysicalProductObservation,
  decideMarketFinderReport,
  planMarketFinderReportDecision,
  planPhysicalProductObservationDecision,
} from "@/lib/moderation/database-transitions";
import {
  marketFinderReportDecisionInputSchema,
  moderationQueueSchema,
  physicalProductEvidenceInputSchema,
  physicalProductObservationDecisionInputSchema,
  type PhysicalProductEvidenceInput,
} from "@/lib/moderation/schema";

const root = process.cwd();
const contributionId = "70928660-17c0-43ef-8bfa-c3f3fe109056";
const marketId = "8f961b67-bfa5-452e-8170-2e22543bb8d3";
const locationId = "4076abc0-2b39-4a30-baad-56933d6ce73b";
const identityVersionId = "9559d142-6578-4220-9894-bdbb10194760";
const observationId = "c890f30c-56cd-4474-84b8-e12bebdfa612";
const operatorSubject = "neon-auth|market-admin";

function queryText(strings: TemplateStringsArray) {
  return strings
    .reduce(
      (text, part, index) => `${text}${index === 0 ? "" : " ? "}${part}`,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function marketDecisionFixture(input: { failAudit?: boolean } = {}) {
  const state = {
    reportStatus: "pending" as "pending" | "approved" | "rejected",
    queries: [] as string[],
    auditRows: [] as { queue: unknown; action: unknown; metadata: unknown }[],
    committed: 0,
    rolledBack: 0,
  };
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings);
    state.queries.push(query);
    if (
      query.includes("from community_contributions") &&
      query.includes("retain_until")
    ) {
      return [
        { id: contributionId, moderation_status: "approved", retained: true },
      ];
    }
    if (
      query.includes("from market_finder_reports") &&
      query.startsWith("select")
    ) {
      return [
        {
          contribution_id: contributionId,
          market_id: marketId,
          retailer_location_id: locationId,
          product_identity_version_id: identityVersionId,
          outcome: "found_bought",
          moderation_status: state.reportStatus,
        },
      ];
    }
    if (query.startsWith("update market_finder_reports")) {
      if (state.reportStatus !== "pending") return [];
      state.reportStatus = values[0] as "approved" | "rejected";
      return [{ contribution_id: contributionId }];
    }
    if (query.startsWith("insert into moderation_audit_log")) {
      if (input.failAudit) throw new Error("simulated market audit failure");
      state.auditRows.push({
        queue: values[1],
        action: values[2],
        metadata: values[6],
      });
      return [];
    }
    throw new Error(`Unexpected Market report fixture query: ${query}`);
  }) as unknown as Sql & {
    begin: <T>(run: (transaction: Sql) => Promise<T>) => Promise<T>;
  };
  tag.json = (value) => value as never;
  tag.begin = async (run) => {
    const previousStatus = state.reportStatus;
    try {
      const result = await (run as (transaction: Sql) => Promise<unknown>)(tag);
      state.committed += 1;
      return result as never;
    } catch (error) {
      state.reportStatus = previousStatus;
      state.rolledBack += 1;
      throw error;
    }
  };
  return { sql: tag as Sql, state };
}

function currentPhysicalEvidence(): PhysicalProductEvidenceInput {
  const observedAt = new Date(Date.now() - 60 * 60 * 1000);
  const expiresAt = new Date(observedAt.getTime() + 24 * 60 * 60 * 1000);
  return {
    contributionId,
    availability: "in_stock",
    observedAt: observedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sourceMethod: "field_visit",
    sourceReference: "field-visit:trade-fair:2026-09-01:01",
    observedTitle: "COSRX Aloe Soothing Sun Cream",
    observedSize: "50 ml",
    priceNgn: 12_500,
    rationale:
      "Field evidence independently confirms the exact title, size, and availability.",
  };
}

function physicalEvidenceFixture(
  input: {
    operatorRole?: "moderator" | "operator" | "admin";
    failAudit?: boolean;
  } = {},
) {
  const state = {
    inserted: false,
    queries: [] as string[],
    auditRows: [] as {
      queue: unknown;
      action: unknown;
      canonicalWrite: unknown;
      metadata: unknown;
    }[],
    committed: 0,
    rolledBack: 0,
  };
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings);
    state.queries.push(query);
    if (query.includes("from moderation_operators")) {
      return [
        {
          id: "80542c0c-a112-46b7-b889-f91eeab6b14d",
          role: input.operatorRole ?? "admin",
        },
      ];
    }
    if (query.includes("from community_contributions")) {
      return [
        { id: contributionId, moderation_status: "approved", retained: true },
      ];
    }
    if (query.includes("from market_finder_reports")) {
      return [
        {
          contribution_id: contributionId,
          market_id: marketId,
          retailer_location_id: locationId,
          product_identity_version_id: identityVersionId,
          outcome: "found_bought",
          moderation_status: "approved",
          location_state: "verified",
          identity_state: "active",
          product_published: true,
        },
      ];
    }
    if (query.startsWith("insert into physical_product_observations")) {
      state.inserted = true;
      return [{ id: observationId }];
    }
    if (query.startsWith("insert into moderation_audit_log")) {
      if (input.failAudit)
        throw new Error("simulated physical evidence audit failure");
      state.auditRows.push({
        queue: values[1],
        action: values[2],
        canonicalWrite: values[4],
        metadata: values[6],
      });
      return [];
    }
    throw new Error(`Unexpected physical evidence fixture query: ${query}`);
  }) as unknown as Sql & {
    begin: <T>(run: (transaction: Sql) => Promise<T>) => Promise<T>;
  };
  tag.json = (value) => value as never;
  tag.begin = async (run) => {
    const previouslyInserted = state.inserted;
    try {
      const result = await (run as (transaction: Sql) => Promise<unknown>)(tag);
      state.committed += 1;
      return result as never;
    } catch (error) {
      state.inserted = previouslyInserted;
      state.rolledBack += 1;
      throw error;
    }
  };
  return { sql: tag as Sql, state };
}

function physicalObservationDecisionFixture(
  input: {
    failAudit?: boolean;
    operatorRole?: "moderator" | "operator" | "admin";
  } = {},
) {
  const state = {
    status: "pending" as "pending" | "approved" | "rejected",
    queries: [] as string[],
    auditRows: [] as {
      queue: unknown;
      action: unknown;
      canonicalWrite: unknown;
      metadata: unknown;
    }[],
    committed: 0,
    rolledBack: 0,
  };
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings);
    state.queries.push(query);
    if (query.includes("from moderation_operators")) {
      return [
        {
          id: "80542c0c-a112-46b7-b889-f91eeab6b14d",
          role: input.operatorRole ?? "admin",
        },
      ];
    }
    if (query.includes("from physical_product_observations observation")) {
      return [
        {
          id: observationId,
          retailer_location_id: locationId,
          product_identity_version_id: identityVersionId,
          moderation_status: state.status,
          source_method: "field_visit",
          observed_at: new Date(Date.now() - 60 * 60 * 1000),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          location_state: "verified",
          location_current: true,
          identity_state: "active",
          product_published: true,
          market_slug: "lagos-trade-fair",
        },
      ];
    }
    if (query.startsWith("update physical_product_observations")) {
      if (state.status !== "pending") return [];
      state.status = values[0] as "approved" | "rejected";
      return [{ id: observationId }];
    }
    if (query.startsWith("insert into moderation_audit_log")) {
      if (input.failAudit)
        throw new Error("simulated observation audit failure");
      state.auditRows.push({
        queue: values[1],
        action: values[2],
        canonicalWrite: values[4],
        metadata: values[6],
      });
      return [];
    }
    throw new Error(`Unexpected observation decision fixture query: ${query}`);
  }) as unknown as Sql & {
    begin: <T>(run: (transaction: Sql) => Promise<T>) => Promise<T>;
  };
  tag.json = (value) => value as never;
  tag.begin = async (run) => {
    const previousStatus = state.status;
    try {
      const result = await (run as (transaction: Sql) => Promise<unknown>)(tag);
      state.committed += 1;
      return result as never;
    } catch (error) {
      state.status = previousStatus;
      state.rolledBack += 1;
      throw error;
    }
  };
  return { sql: tag as Sql, state };
}

test("Market Finder moderation schemas are strict and evidence windows are source-bounded", () => {
  assert.equal(
    moderationQueueSchema.parse("market_finder_report"),
    "market_finder_report",
  );
  assert.equal(
    moderationQueueSchema.parse("retailer_location"),
    "retailer_location",
  );
  assert.equal(
    moderationQueueSchema.parse("physical_product_observation"),
    "physical_product_observation",
  );
  assert.throws(() =>
    marketFinderReportDecisionInputSchema.parse({
      contributionId,
      decision: "approve",
      rationale: "",
    }),
  );
  assert.throws(() =>
    marketFinderReportDecisionInputSchema.parse({
      contributionId,
      decision: "approve",
      rationale: "Reviewed.",
      inferredAvailability: "in_stock",
    }),
  );

  assert.equal(
    physicalProductEvidenceInputSchema.parse(currentPhysicalEvidence())
      .priceNgn,
    12_500,
  );
  const observedAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + 15 * 24 * 60 * 60 * 1000,
  ).toISOString();
  assert.throws(
    () =>
      physicalProductEvidenceInputSchema.parse({
        ...currentPhysicalEvidence(),
        observedAt,
        expiresAt,
        sourceMethod: "field_visit",
      }),
    /allowed evidence window/,
  );
  assert.throws(() =>
    physicalProductEvidenceInputSchema.parse({
      ...currentPhysicalEvidence(),
      priceNgn: 0,
    }),
  );
  assert.throws(() =>
    physicalProductEvidenceInputSchema.parse({
      ...currentPhysicalEvidence(),
      priceNgn: 12_500.001,
    }),
  );
  assert.deepEqual(
    physicalProductObservationDecisionInputSchema.parse({
      observationId,
      decision: "approve",
      rationale: "Current independent evidence is sufficient.",
    }),
    {
      observationId,
      decision: "approve",
      rationale: "Current independent evidence is sufficient.",
    },
  );
});

test("least-privilege capability routing keeps physical evidence admin-only", async () => {
  const source = await readFile(
    path.join(root, "lib/moderation/capabilities.ts"),
    "utf8",
  );
  const moderator =
    source.match(/moderator:\s*\[([\s\S]*?)\],\s*operator:/)?.[1] ?? "";
  const operator =
    source.match(/operator:\s*\[([\s\S]*?)\],\s*admin:/)?.[1] ?? "";
  const admin = source.match(/admin:\s*\[([\s\S]*?)\],\s*\};/)?.[1] ?? "";
  assert.doesNotMatch(
    moderator,
    /market-reports\.decide|physical-evidence\.manage/,
  );
  assert.match(operator, /market-reports\.decide/);
  assert.doesNotMatch(operator, /physical-evidence\.manage/);
  assert.match(admin, /market-reports\.decide/);
  assert.match(admin, /physical-evidence\.manage/);
});

test("the child decision planner requires a retained approved matching parent and a pending child", () => {
  assert.equal(
    planMarketFinderReportDecision({
      contributionId,
      reportContributionId: contributionId,
      parentStatus: "approved",
      parentRetained: true,
      reportStatus: "pending",
      decision: "approve",
    }).nextStatus,
    "approved",
  );
  assert.throws(
    () =>
      planMarketFinderReportDecision({
        contributionId,
        reportContributionId: contributionId,
        parentStatus: "pending",
        parentRetained: true,
        reportStatus: "pending",
        decision: "approve",
      }),
    /Approve the parent contribution/,
  );
  assert.throws(
    () =>
      planMarketFinderReportDecision({
        contributionId,
        reportContributionId: marketId,
        parentStatus: "approved",
        parentRetained: true,
        reportStatus: "pending",
        decision: "reject",
      }),
    /does not match its parent/,
  );
  assert.throws(
    () =>
      planMarketFinderReportDecision({
        contributionId,
        reportContributionId: contributionId,
        parentStatus: "approved",
        parentRetained: false,
        reportStatus: "pending",
        decision: "reject",
      }),
    /expired parent/,
  );
  assert.throws(
    () =>
      planMarketFinderReportDecision({
        contributionId,
        reportContributionId: contributionId,
        parentStatus: "approved",
        parentRetained: true,
        reportStatus: "mapped",
        decision: "reject",
      }),
    /already settled/,
  );
});

test("a direct child decision and its attributable audit commit or roll back together", async () => {
  const fixture = marketDecisionFixture();
  await decideMarketFinderReport(
    fixture.sql,
    operatorSubject,
    contributionId,
    "approve",
    "The exact product and locked physical context are reviewable.",
  );
  assert.equal(fixture.state.reportStatus, "approved");
  assert.equal(fixture.state.committed, 1);
  assert.deepEqual(fixture.state.auditRows, [
    {
      queue: "market_finder_report",
      action: "approve",
      metadata: {
        parentContributionId: contributionId,
        marketId,
        retailerLocationId: locationId,
        productIdentityVersionId: identityVersionId,
        outcome: "found_bought",
        previousStatus: "pending",
        nextStatus: "approved",
      },
    },
  ]);
  const parentLock = fixture.state.queries.findIndex((query) =>
    query.includes("from community_contributions"),
  );
  const childLock = fixture.state.queries.findIndex((query) =>
    query.includes("from market_finder_reports"),
  );
  const childUpdate = fixture.state.queries.findIndex((query) =>
    query.startsWith("update market_finder_reports"),
  );
  const auditInsert = fixture.state.queries.findIndex((query) =>
    query.startsWith("insert into moderation_audit_log"),
  );
  assert.ok(
    parentLock < childLock &&
      childLock < childUpdate &&
      childUpdate < auditInsert,
  );

  const rollback = marketDecisionFixture({ failAudit: true });
  await assert.rejects(
    () =>
      decideMarketFinderReport(
        rollback.sql,
        operatorSubject,
        contributionId,
        "reject",
        "Reject this exact report.",
      ),
    /simulated market audit failure/,
  );
  assert.equal(rollback.state.reportStatus, "pending");
  assert.equal(rollback.state.rolledBack, 1);
});

test("parent rejection delegates only the pending child cascade to the database trigger", async () => {
  const source = await readFile(
    path.join(root, "lib/moderation/database-transitions.ts"),
    "utf8",
  );
  const start = source.indexOf("export async function decideContribution");
  const end = source.indexOf(
    "export async function decideMarketFinderReport",
    start,
  );
  const decision = source.slice(start, end);
  assert.match(
    decision,
    /if \(decision === ["']reject["']\)[\s\S]*?from market_finder_reports/,
  );
  assert.match(decision, /moderation_status = 'pending'[\s\S]*?for update/);
  assert.doesNotMatch(decision, /update market_finder_reports/);
  assert.match(
    decision,
    /marketFinderReportCascade:[\s\S]*?["']database_trigger["']/,
  );
  assert.match(decision, /recordModerationAction\(tx/);
});

test("physical evidence append and audit share one transaction and never infer fields", async () => {
  const fixture = physicalEvidenceFixture();
  const evidence = currentPhysicalEvidence();
  const created = await createPhysicalProductObservation(
    fixture.sql,
    operatorSubject,
    evidence,
  );
  assert.equal(created, observationId);
  assert.equal(fixture.state.inserted, true);
  assert.equal(fixture.state.committed, 1);
  assert.equal(
    fixture.state.auditRows[0]?.queue,
    "physical_product_observation",
  );
  assert.equal(fixture.state.auditRows[0]?.action, "promote");
  assert.equal(fixture.state.auditRows[0]?.canonicalWrite, true);
  assert.deepEqual(fixture.state.auditRows[0]?.metadata, {
    operation: "append_pending_evidence",
    parentContributionId: contributionId,
    marketId,
    retailerLocationId: locationId,
    productIdentityVersionId: identityVersionId,
    reportOutcome: "found_bought",
    availability: "in_stock",
    priceNgn: 12_500,
    observedAt: evidence.observedAt,
    expiresAt: evidence.expiresAt,
    sourceMethod: "field_visit",
    sourceReference: "field-visit:trade-fair:2026-09-01:01",
  });
  const evidenceInsert = fixture.state.queries.findIndex((query) =>
    query.startsWith("insert into physical_product_observations"),
  );
  const auditInsert = fixture.state.queries.findIndex((query) =>
    query.startsWith("insert into moderation_audit_log"),
  );
  assert.ok(evidenceInsert >= 0 && evidenceInsert < auditInsert);

  const rollback = physicalEvidenceFixture({ failAudit: true });
  await assert.rejects(
    () =>
      createPhysicalProductObservation(
        rollback.sql,
        operatorSubject,
        currentPhysicalEvidence(),
      ),
    /simulated physical evidence audit failure/,
  );
  assert.equal(rollback.state.inserted, false);
  assert.equal(rollback.state.rolledBack, 1);

  const operator = physicalEvidenceFixture({ operatorRole: "operator" });
  await assert.rejects(
    () =>
      createPhysicalProductObservation(
        operator.sql,
        operatorSubject,
        currentPhysicalEvidence(),
      ),
    /Only an active admin/,
  );
  assert.equal(operator.state.inserted, false);
});

test("physical observation decisions accept only a pending exact observation", () => {
  assert.deepEqual(
    planPhysicalProductObservationDecision({
      observationId,
      status: "pending",
      decision: "approve",
    }),
    {
      observationId,
      previousStatus: "pending",
      nextStatus: "approved",
      decision: "approve",
    },
  );
  assert.throws(
    () =>
      planPhysicalProductObservationDecision({
        observationId,
        status: "approved",
        decision: "reject",
      }),
    /already settled/,
  );
});

test("physical observation decision, reviewer pair, and audit commit or roll back together", async () => {
  const fixture = physicalObservationDecisionFixture();
  const result = await decidePhysicalProductObservation(
    fixture.sql,
    operatorSubject,
    observationId,
    "approve",
    "Current field evidence and the exact identity are sufficient.",
  );
  assert.deepEqual(result, {
    observationId,
    marketSlug: "lagos-trade-fair",
    retailerLocationId: locationId,
    productIdentityVersionId: identityVersionId,
    nextStatus: "approved",
  });
  assert.equal(fixture.state.status, "approved");
  assert.equal(fixture.state.committed, 1);
  assert.deepEqual(fixture.state.auditRows, [
    {
      queue: "physical_product_observation",
      action: "approve",
      canonicalWrite: true,
      metadata: {
        retailerLocationId: locationId,
        productIdentityVersionId: identityVersionId,
        previousStatus: "pending",
        nextStatus: "approved",
        sourceMethod: "field_visit",
      },
    },
  ]);
  const observationLock = fixture.state.queries.findIndex(
    (query) =>
      query.includes("from physical_product_observations observation") &&
      query.includes("for update of observation"),
  );
  const update = fixture.state.queries.findIndex((query) =>
    query.startsWith("update physical_product_observations"),
  );
  const audit = fixture.state.queries.findIndex((query) =>
    query.startsWith("insert into moderation_audit_log"),
  );
  assert.ok(observationLock >= 0 && observationLock < update && update < audit);

  const rollback = physicalObservationDecisionFixture({ failAudit: true });
  await assert.rejects(
    () =>
      decidePhysicalProductObservation(
        rollback.sql,
        operatorSubject,
        observationId,
        "reject",
        "This evidence cannot be approved.",
      ),
    /simulated observation audit failure/,
  );
  assert.equal(rollback.state.status, "pending");
  assert.equal(rollback.state.rolledBack, 1);

  const operator = physicalObservationDecisionFixture({
    operatorRole: "operator",
  });
  await assert.rejects(
    () =>
      decidePhysicalProductObservation(
        operator.sql,
        operatorSubject,
        observationId,
        "reject",
        "Reject this evidence.",
      ),
    /Only an active admin/,
  );
  assert.equal(operator.state.status, "pending");
});

test("the contribution inspector exposes locked context and separate report controls only", async () => {
  const [inbox, page, queues] = await Promise.all([
    readFile(
      path.join(root, "app/(ops)/ops/contributions/ContributionsInbox.tsx"),
      "utf8",
    ),
    readFile(path.join(root, "app/(ops)/ops/contributions/page.tsx"), "utf8"),
    readFile(path.join(root, "lib/moderation/queues.ts"), "utf8"),
  ]);
  assert.match(page, /can\(operator\.role, ["']market-reports\.decide["']\)/);
  assert.match(inbox, />\s*Market report\s*</);
  assert.match(inbox, />\s*Exact product\s*</);
  assert.match(inbox, />\s*Identity version\s*</);
  assert.match(inbox, />\s*Retailer location\s*</);
  assert.match(inbox, />\s*Parent state\s*</);
  assert.match(inbox, />\s*Report state\s*</);
  assert.match(
    inbox,
    /Approve the parent contribution|Decide the parent contribution/,
  );
  assert.match(inbox, /This decision classifies the report only/);
  assert.match(inbox, /name="rationale"[\s\S]*?required/);
  assert.doesNotMatch(
    inbox,
    /createPhysicalProductObservation|physical evidence form/i,
  );
  assert.match(inbox, /setDecisionAnnouncement/);
  assert.match(
    inbox,
    /<DecisionAnnouncement message=\{visibleDecisionAnnouncement\} \/>/,
  );
  assert.doesNotMatch(inbox, /visibleIds\.has/);
  assert.match(
    queues,
    /contribution\.moderation_status = 'approved'[\s\S]*?report\.moderation_status = 'pending'/,
  );

  const item = contributionWorkItem({
    id: contributionId,
    kind: "store",
    payload: {},
    moderationStatus: "approved",
    submittedAt: "2026-09-01T12:00:00.000Z",
    retainUntil: "2026-12-01T12:00:00.000Z",
    pendingEdgeCount: 0,
    pendingObservationCount: 0,
    attribution: null,
    marketReport: {
      contributionId,
      marketId,
      marketName: "Lagos Trade Fair Complex",
      retailerLocationId: locationId,
      retailerLocationName: "Shop A43, Akwa-Ibom Plaza",
      retailerName: "Cyncel Cosmetics",
      productIdentityVersionId: identityVersionId,
      productBrand: "COSRX",
      productVariant: "Aloe Soothing Sun Cream",
      productSize: "50 ml",
      outcome: "found_bought",
      moderationStatus: "pending",
    },
  });
  assert.equal(item.kind, "store");
  assert.equal(item.kindLabel, "Market Finder report");
  assert.equal(item.title, "COSRX · Aloe Soothing Sun Cream · 50 ml");
});

test("the client inspector keeps server presentation dependencies out of its bundle", async () => {
  const root = process.cwd();
  const inbox = await readFile(
    path.join(root, "app/(ops)/ops/contributions/ContributionsInbox.tsx"),
    "utf8",
  );
  const labels = await readFile(
    path.join(root, "app/(ops)/ops/contributions/market-report-labels.ts"),
    "utf8",
  );

  assert.match(inbox, /from ["'].\/market-report-labels["']/);
  assert.match(
    inbox,
    /import type \{ ContributionWorkItem \} from ["'].\/market-report-presentation["']/,
  );
  assert.doesNotMatch(labels, /contribution-presentation|moderation\/queues/);
});
