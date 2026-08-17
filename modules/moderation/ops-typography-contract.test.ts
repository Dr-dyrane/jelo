import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const opsTypographySources = [
  "app/(ops)/ops.module.css",
  "app/(ops)/ops/overview.module.css",
  "app/(ops)/ops/care-evidence/care-evidence.module.css",
  "app/(ops)/ops/edges/edges.module.css",
  "app/(ops)/ops/observations/observations.module.css",
  "app/(ops)/ops/observations/observations-shell.module.css",
  "app/(ops)/ops/contributions/contributions.module.css",
  "app/(ops)/ops/vocabulary/vocabulary.module.css",
  "app/(ops)/ops/vocabulary/vocabulary-shell.module.css",
  "app/(ops)/ops/activity/activity.module.css",
  "app/(ops)/ops/operators/operators.module.css",
  "app/(ops)/ops/retailers/retailers.module.css",
  "app/(ops)/ops/signals/signals.module.css",
  "components/ops/chips/chips.module.css",
  "components/ops/inbox/inbox.module.css",
  "components/ops/inbox/inbox-tablet.module.css",
  "components/ops/shell/ops-tablet.module.css",
  "components/ops/state/state.module.css",
] as const;

const opsLiteralSources = [
  "app/(ops)/layout.tsx",
  "app/(ops)/ops/OverviewBriefing.tsx",
  "app/(ops)/ops/OverviewLoadingInspector.tsx",
  "app/(ops)/ops/activity/ActivityInsights.tsx",
  "app/(ops)/ops/activity/error.tsx",
  "app/(ops)/ops/activity/loading.tsx",
  "app/(ops)/ops/activity/page.tsx",
  "app/(ops)/ops/care-evidence/CareEvidenceView.tsx",
  "app/(ops)/ops/care-evidence/error.tsx",
  "app/(ops)/ops/care-evidence/loading.tsx",
  "app/(ops)/ops/care-evidence/page.tsx",
  "app/(ops)/ops/contributions/ContributionDetailSkeleton.tsx",
  "app/(ops)/ops/contributions/ContributionsInbox.tsx",
  "app/(ops)/ops/contributions/error.tsx",
  "app/(ops)/ops/contributions/loading.tsx",
  "app/(ops)/ops/contributions/page.tsx",
  "app/(ops)/ops/edges/EdgesInbox.tsx",
  "app/(ops)/ops/edges/RelationshipDetailSkeleton.tsx",
  "app/(ops)/ops/edges/error.tsx",
  "app/(ops)/ops/edges/loading.tsx",
  "app/(ops)/ops/edges/page.tsx",
  "app/(ops)/ops/error.tsx",
  "app/(ops)/ops/loading.tsx",
  "app/(ops)/ops/observations/ObservationDetailSkeleton.tsx",
  "app/(ops)/ops/observations/ObservationsInbox.tsx",
  "app/(ops)/ops/observations/error.tsx",
  "app/(ops)/ops/observations/loading.tsx",
  "app/(ops)/ops/observations/page.tsx",
  "app/(ops)/ops/operators/OperatorDetailSkeleton.tsx",
  "app/(ops)/ops/operators/OperatorsDirectory.tsx",
  "app/(ops)/ops/operators/error.tsx",
  "app/(ops)/ops/operators/loading.tsx",
  "app/(ops)/ops/operators/page.tsx",
  "app/(ops)/ops/page.tsx",
  "app/(ops)/ops/retailers/RetailersInbox.tsx",
  "app/(ops)/ops/retailers/error.tsx",
  "app/(ops)/ops/retailers/loading.tsx",
  "app/(ops)/ops/retailers/page.tsx",
  "app/(ops)/ops/signals/SignalsMonitor.tsx",
  "app/(ops)/ops/signals/SignalsRefreshControl.tsx",
  "app/(ops)/ops/signals/error.tsx",
  "app/(ops)/ops/signals/loading.tsx",
  "app/(ops)/ops/signals/page.tsx",
  "app/(ops)/ops/ui.tsx",
  "app/(ops)/ops/vocabulary/VocabularyDetailSkeleton.tsx",
  "app/(ops)/ops/vocabulary/VocabularyInbox.tsx",
  "app/(ops)/ops/vocabulary/VocabularyTargetPicker.tsx",
  "app/(ops)/ops/vocabulary/error.tsx",
  "app/(ops)/ops/vocabulary/loading.tsx",
  "app/(ops)/ops/vocabulary/page.tsx",
  "components/ops/chips/IdChip.tsx",
  "components/ops/chips/ProductRef.tsx",
  "components/ops/chips/RelativeTime.tsx",
  "components/ops/chips/StatusPill.tsx",
  "components/ops/inbox/InboxContainer.tsx",
  "components/ops/shell/OpsChrome.tsx",
  "components/ops/shell/OpsSidebar.tsx",
  "components/ops/state/EmptyState.tsx",
  "components/ops/state/ErrorState.tsx",
  "components/ops/state/Skeleton.tsx",
  "components/ops/visuals/OpsRecordVisual.tsx",
  "components/ops/workspace/OpsWorkspace.tsx",
] as const;

const intentionalUppercaseTokens = new Set([
  "ID",
  "NG",
  "NGN",
  "OP",
  "JC",
  "T12",
  "US",
  "USD",
  "UTC",
]);

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

function quotedAndJsxText(source: string) {
  const values: string[] = [];

  for (const match of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    values.push(match[2]);
  }
  for (const match of source.matchAll(/>([^<{]+)</g)) {
    const candidate = match[1].trim();
    if (candidate && !/[?=()]/.test(candidate)) values.push(candidate);
  }

  return values;
}

test("Ops interface labels stay sentence case without all-caps tracking", async () => {
  const sources = await Promise.all(
    opsTypographySources.map(async (relativePath) => ({
      relativePath,
      source: await readSource(relativePath),
    })),
  );

  for (const { relativePath, source } of sources) {
    assert.doesNotMatch(
      source,
      /text-transform:\s*uppercase/i,
      `${relativePath} must not force interface text to uppercase`,
    );
    assert.doesNotMatch(
      source,
      /letter-spacing:\s*var\(--tracking-label\)/i,
      `${relativePath} must not use the legacy all-caps tracking token`,
    );

    for (const match of source.matchAll(
      /letter-spacing:\s*([+-]?(?:\d*\.)?\d+)em/gi,
    )) {
      assert.ok(
        Number(match[1]) <= 0,
        `${relativePath} must not use positive all-caps-style tracking (${match[0]})`,
      );
    }
  }
});

test("Ops eyebrows, subtle section labels, and status pills use regular text", async () => {
  const [
    shell,
    overview,
    edges,
    observations,
    contributions,
    vocabulary,
    activity,
    operators,
    signals,
    inbox,
    chips,
  ] = await Promise.all([
    readSource("app/(ops)/ops.module.css"),
    readSource("app/(ops)/ops/overview.module.css"),
    readSource("app/(ops)/ops/edges/edges.module.css"),
    readSource("app/(ops)/ops/observations/observations.module.css"),
    readSource("app/(ops)/ops/contributions/contributions.module.css"),
    readSource("app/(ops)/ops/vocabulary/vocabulary.module.css"),
    readSource("app/(ops)/ops/activity/activity.module.css"),
    readSource("app/(ops)/ops/operators/operators.module.css"),
    readSource("app/(ops)/ops/signals/signals.module.css"),
    readSource("components/ops/inbox/inbox.module.css"),
    readSource("components/ops/chips/chips.module.css"),
  ]);

  for (const source of [
    shell,
    overview,
    edges,
    observations,
    contributions,
    vocabulary,
    activity,
    operators,
    signals,
    inbox,
    chips,
  ]) {
    assert.match(source, /font-weight:\s*var\(--weight-regular\)/);
  }

  assert.match(
    overview,
    /\.upNextEyebrow\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    edges,
    /\.relationshipKicker\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    observations,
    /\.featureEyebrow\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    contributions,
    /\.featureEyebrow\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    vocabulary,
    /\.targetResultsHeading\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    activity,
    /\.detailSection h3\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    operators,
    /\.featureEyebrow\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    operators,
    /\.detailSection > h3,[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    signals,
    /\.eyebrow\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    inbox,
    /\.detailEyebrow,[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
  assert.match(
    chips,
    /\.pill\s*\{[\s\S]*?font-weight:\s*var\(--weight-regular\)/,
  );
});

test("Ops JSX copy has no hard-coded all-caps interface labels", async () => {
  const sources = await Promise.all(
    opsLiteralSources.map(async (relativePath) => ({
      relativePath,
      source: await readSource(relativePath),
    })),
  );

  for (const { relativePath, source } of sources) {
    for (const value of quotedAndJsxText(source)) {
      const literalCopy = value.replace(/\$\{[^}]*\}/g, "");
      for (const match of literalCopy.matchAll(/\b[A-Z][A-Z0-9]{1,}\b/g)) {
        const token = match[0];
        assert.ok(
          intentionalUppercaseTokens.has(token),
          `${relativePath} contains a hard-coded all-caps token in interface copy: ${token}`,
        );
      }
    }
  }
});
