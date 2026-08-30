import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("Insights is a title-only read model rather than a second moderation queue", async () => {
  const [page, view] = await Promise.all([
    readSource("app/(ops)/ops/activity/page.tsx"),
    readSource("app/(ops)/ops/activity/ActivityInsights.tsx"),
  ]);

  assert.match(page, /<OpsWorkspace title="Insights">/);
  assert.match(page, /getActivityInference/);
  assert.doesNotMatch(page, /\blede=|<h1|Decision history<\/h1>/);
  assert.doesNotMatch(view, /decide|approveAction|rejectAction|formAction/);
});

test("Insights only aggregates retained approved notes and suppresses every tiny pattern cell", async () => {
  const model = await readSource("lib/moderation/activity-read-model.ts");

  assert.match(model, /moderation_status = 'approved'/);
  assert.match(model, /retain_until > now\(\)/);
  assert.equal(
    model.match(/having count\(distinct contribution_id\) >= 3/g)?.length,
    2,
  );
  assert.match(
    model,
    /count\(distinct contribution_id\)::int as mention_count/,
  );
  assert.doesNotMatch(
    model,
    /anonymous_user_id|contributor_(?:id|email)|ip_address|user_agent/,
  );
});

test("pattern labels come from the canonical registry or an accepted moderation value", async () => {
  const model = await readSource("lib/moderation/activity-read-model.ts");

  assert.match(
    model,
    /jsonb_to_recordset\(\$\{sql\.json\(communityPurposeOptions\)\}/,
  );
  assert.match(
    model,
    /jsonb_to_recordset\(\$\{sql\.json\(communityRetailerOptions\)\}/,
  );
  assert.match(model, /value\.status = 'approved'/);
  assert.match(model, /value\.status = 'mapped'/);
  assert.match(model, /value\.canonical_entity_kind = 'purpose'/);
  assert.match(model, /value\.canonical_entity_kind = 'retailer'/);
  assert.doesNotMatch(
    model,
    /group by purpose ->> 'label'|group by retailer ->> 'label'/,
  );
});

test("Insights keeps early community patterns distinct from proof", async () => {
  const view = await readSource("app/(ops)/ops/activity/ActivityInsights.tsx");

  assert.match(
    view,
    /Early sample · \{number\.format\(community\.approvedNotes\)\} approved notes/,
  );
  assert.match(view, /Community reported/);
  assert.match(view, /do not prove results or retailer trust/);
  assert.match(
    view,
    /approvedNoteWindow\(community\.firstNoteAt, community\.lastNoteAt, community\.activeDays\)/,
  );
  assert.match(view, /denominator=\{community\.approvedNotes\}/);
  assert.doesNotMatch(view, /\bcontributors?\b/i);
  assert.doesNotMatch(view, /\btrend(?:ing)?\b/i);
  assert.doesNotMatch(view, /\beffective(?:ness)?\b/i);
});

test("Insights uses compact, accessible donuts for both mutually exclusive compositions", async () => {
  const [view, styles] = await Promise.all([
    readSource("app/(ops)/ops/activity/ActivityInsights.tsx"),
    readSource("app/(ops)/ops/activity/activity.module.css"),
  ]);

  assert.match(view, /Community knowledge/);
  assert.match(view, /Product research/);
  assert.match(view, /What comes up/);
  assert.match(view, /What the notes added/);
  assert.match(view, /Updated <RelativeTime/);
  assert.match(view, /matchedExisting/);
  assert.match(view, /intakeCandidates/);
  assert.match(view, /needClarity/);
  assert.match(view, /dismissedDuplicates/);
  assert.match(view, /resolvedProductResearch/);
  assert.match(view, /function CompositionDonut/);
  assert.equal(view.match(/<CompositionDonut/g)?.length, 2);
  assert.match(
    view,
    /<figure className=\{styles\.donutFigure\} role="img" aria-label=\{accessibleLabel\}>/,
  );
  assert.match(view, /<svg viewBox="0 0 80 80" aria-hidden="true">/);
  assert.match(view, /pathLength="100"/);
  assert.match(view, /strokeDasharray=/);
  assert.match(view, /total=\{community\.approvedNotes\}/);
  assert.match(view, /label: 'product notes'/);
  assert.match(view, /label: 'routine notes'/);
  assert.match(view, /label: 'store notes'/);
  assert.match(view, /total=\{research\.resolvedProductResearch\}/);
  assert.match(view, /label: 'matched'/);
  assert.match(view, /label: 'intake candidates'/);
  assert.match(view, /label: 'need clarity'/);
  assert.doesNotMatch(view, /\bSegment\b|segmentBar|title=/);
  assert.doesNotMatch(view, /moving forward/i);
  assert.doesNotMatch(view, /dailyVolume|lineChart|growth chart/i);
  assert.doesNotMatch(styles, /radial-gradient/);
  assert.doesNotMatch(styles, /6\.2rem|8vw/);
  assert.match(styles, /font-size: clamp\(2rem, 4vw, 2\.8rem\)/);
  assert.match(
    styles,
    /\.snapshotCard \{[\s\S]*?min-height: 164px;[\s\S]*?grid-template-columns:/,
  );
  assert.match(styles, /\.donutArc \{[\s\S]*?transform: rotate\(-90deg\)/);
  assert.match(
    styles,
    /\.donutArc\[data-tone=["']product["']\],[\s\S]*?stroke: var\(--ops-accent\)/,
  );
  assert.doesNotMatch(styles, /\.segmentBar|overflow-x: auto|scroll-snap-type/);
  assert.match(
    styles,
    /@media \(max-width: 649px\) \{[\s\S]*?\.snapshotRail \{[\s\S]*?grid-template-columns: 1fr;/,
  );
});

test("Decision history is human-readable while raw references remain secondary", async () => {
  const [model, view, resolver] = await Promise.all([
    readSource("lib/moderation/activity-read-model.ts"),
    readSource("app/(ops)/ops/activity/ActivityInsights.tsx"),
    readSource("lib/moderation/ops-product-visuals.ts"),
  ]);

  assert.match(model, /as target_label/);
  assert.match(model, /as product_ref/);
  assert.match(model, /#>> '\{products,0,source\}' = 'canonical'/);
  assert.match(
    model,
    /left join products product on product\.slug = event\.product_slug/,
  );
  assert.match(model, /select event\.product_slug/);
  assert.match(model, /resolveOpsProductImages/);
  assert.match(resolver, /listCatalogueProducts/);
  assert.doesNotMatch(resolver, /raw_value|targetLabel|https?:\/\//);
  assert.match(view, /\{decision\.targetLabel\}/);
  assert.match(view, /image=\{decision\.image\}/);
  assert.match(view, /fallback=\{<QueueIcon queue=\{decision\.queue\} \/>/);
  assert.match(view, /<summary>More context<\/summary>/);
  assert.match(view, /\{decision\.targetRef\}/);
  assert.match(view, /collectionLabel="Decision history"/);
  assert.match(view, /globalKeyboardShortcuts=\{false\}/);
  assert.match(
    model,
    /image: row\.product_ref \? productImages\.get\(row\.product_ref\) \?\? null : null/,
  );
  const primaryRow = view.slice(
    view.indexOf("renderItemRow="),
    view.indexOf("renderItemDetails="),
  );
  assert.doesNotMatch(primaryRow, /targetRef/);
});

test("global audit history uses the durable event sequence and guarded UUID lookups", async () => {
  const [model, migration] = await Promise.all([
    readSource("lib/moderation/activity-read-model.ts"),
    readSource("db/migrations/0032_moderation_audit_event_sequence.sql"),
  ]);

  assert.match(model, /audit\.target_ref ~\* \$\{uuidPattern\}/);
  assert.doesNotMatch(model, /\.id::text = audit\.target_ref/);
  assert.match(
    migration,
    /moderation_audit_log \(queue, target_ref, event_sequence desc\)/,
  );
  assert.match(model, /order by audit\.event_sequence desc/);
});

test("Insights owns geometry-matched loading and a private retry state", async () => {
  const [loading, error] = await Promise.all([
    readSource("app/(ops)/ops/activity/loading.tsx"),
    readSource("app/(ops)/ops/activity/error.tsx"),
  ]);

  assert.match(loading, /aria-label="Loading insights"/);
  assert.match(loading, /styles\.snapshotRail/);
  assert.match(loading, /styles\.skeletonCopy/);
  assert.match(loading, /styles\.skeletonDonut/);
  assert.match(loading, /styles\.patternColumns/);
  assert.match(loading, /styles\.evidenceRows/);
  assert.match(loading, /styles\.skeletonLedger/);
  assert.match(loading, /styles\.skeletonDecisionVisual/);
  assert.match(
    loading,
    /window\.matchMedia\('\(min-width: 1180px\)'\)\.matches/,
  );
  assert.match(loading, /data-ops-reserve-detail/);
  assert.match(loading, /<DetailSkeleton \/>/);
  assert.match(error, /Couldn’t load insights/);
  assert.match(error, /onRetry=\{reset\}/);
  assert.doesNotMatch(error, /error\.(?:message|stack)/);
});

test("every triage empty state stays put and offers Insights", async () => {
  const pages = await Promise.all(
    ["contributions", "edges", "observations", "vocabulary", "retailers"].map(
      (route) => readSource(`app/(ops)/ops/${route}/page.tsx`),
    ),
  );

  for (const page of pages) {
    assert.match(page, /title="You’re caught up\."/);
    assert.match(
      page,
      /action=\{\{ href: '\/ops\/activity', label: 'View insights' \}\}/,
    );
    assert.doesNotMatch(page, /redirect\(['"]\/ops\/activity/);
  }
});
