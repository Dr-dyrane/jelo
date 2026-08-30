import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// Build-time guard for ADR 0007: the moderation console is an internal, audited
// surface that promotes to canonical only through the existing gates. It must
// never write a canonical catalogue record itself, and access must default to
// deny. Source-scanned because the modules are `server-only` and cannot be
// imported by this runner.
test("the moderation console writes only its audit log and denies access by default", async () => {
  const root = process.cwd();
  const files = [
    "schema.ts",
    "audit.ts",
    "access.ts",
    "queues.ts",
    "transitions.ts",
    "database-transitions.ts",
    "action-input.ts",
  ];
  const sources = await Promise.all(
    files.map((file) =>
      readFile(path.join(root, "lib/moderation", file), "utf8"),
    ),
  );
  const all = sources.join("\n");

  // Never writes or mutates a canonical catalogue record.
  assert.doesNotMatch(
    all,
    /insert into (products|brands|retailers|offers|concerns|ingredients)\b/i,
  );
  assert.doesNotMatch(
    all,
    /update (products|brands|retailers|offers|concerns|ingredients)\b/i,
  );
  assert.doesNotMatch(all, /@vercel\/blob|put\(/);

  // The only table the console writes is its audit log.
  const insertTargets = [...all.matchAll(/insert into (\w+)/gi)].map((match) =>
    match[1].toLowerCase(),
  );
  assert.deepEqual([...new Set(insertTargets)], ["moderation_audit_log"]);

  // Access is deny-by-default and never infers identity from a header, cookie, or query param.
  const access = sources[files.indexOf("access.ts")];
  // operatorAuthSubject must delegate to the verified session helper — never a
  // hardcoded value — and identity must come only from getAuthSubject().
  assert.match(
    access,
    /import \{ getAuthSubject \} from ["']@\/lib\/auth\/subject["'];/,
  );
  assert.match(
    access,
    /export async function operatorAuthSubject\(\): Promise<string \| null> \{\s*const identity = await getAuthSubject\(\);\s*return identity\?\.subject \?\? null;\s*\}/,
  );
  assert.match(access, /and active = true/);
  assert.match(access, /throw new ModerationAccessError/);
  assert.doesNotMatch(
    access,
    /headers\(\)|cookies\(\)|searchParams|request\.headers/,
  );

  const databaseTransitions = sources[files.indexOf("database-transitions.ts")];
  assert.match(
    databaseTransitions,
    /update community_knowledge_edges[\s\S]*contribution_id = \$\{id\}/,
  );
  assert.match(
    databaseTransitions,
    /update community_observations[\s\S]*contribution_id = \$\{id\}/,
  );
  assert.match(databaseTransitions, /contribution\.retain_until > now\(\)/);
  assert.match(databaseTransitions, /action: 'map'/);
  assert.match(databaseTransitions, /action: 'reconcile'/);
});

test("operator access denial logs cannot disclose verified identities", async () => {
  const access = await readFile(
    path.join(process.cwd(), "lib/moderation/access.ts"),
    "utf8",
  );
  const logPayloads = [
    ...access.matchAll(
      /console\.(?:debug|info|log|warn|error)\(([\s\S]*?)\);/g,
    ),
  ].map((match) => match[1]);

  assert.equal(logPayloads.length, 2);
  for (const payload of logPayloads) {
    assert.doesNotMatch(
      payload,
      /authSubject|identity|email|row\.id|operator\.id|\$\{/,
    );
  }
  assert.match(
    access,
    /event: ["']operator_access_denied["'],[\s\S]*reason: ["']missing_verified_session["']/,
  );
  assert.match(
    access,
    /event: ["']operator_access_denied["'],[\s\S]*reason: ["']verified_subject_not_allowlisted["']/,
  );

  // Identity still comes from the verified session, authorization remains an
  // active allowlist, and the invitation/concurrency path stays fail-closed.
  assert.match(access, /const identity = await getAuthSubject\(\);/);
  assert.match(
    access,
    /where auth_subject = \$\{authSubject\} and active = true/,
  );
  assert.match(access, /claimPendingOperatorInvitation\(sql, identity\)/);
  assert.match(
    access,
    /return resolveActiveOperator\(sql, identity\.subject\);/,
  );
  assert.match(
    access,
    /if \(isOperatorAccessLifecycleUnavailable\(error\)\) return null;/,
  );
  assert.match(access, /if \(!operator\) throw new ModerationAccessError\(\);/);
});

test("the phone shell always exposes one real contextual action", async () => {
  const root = process.cwd();
  const [chrome, inbox, overview] = await Promise.all([
    readFile(path.join(root, "components/ops/shell/OpsChrome.tsx"), "utf8"),
    readFile(
      path.join(root, "components/ops/inbox/InboxContainer.tsx"),
      "utf8",
    ),
    readFile(path.join(root, "app/(ops)/ops/OverviewBriefing.tsx"), "utf8"),
  ]);

  assert.match(chrome, /const defaultContextFab: ContextFabConfig = \{/);
  assert.match(chrome, /onClick: \(\) => router\.refresh\(\)/);
  assert.match(chrome, /const hasCustomContextFab\s*=/);
  assert.match(
    chrome,
    /const contextFab = hasCustomContextFab\s*\? contextFabState\.value\s*: defaultContextFab/,
  );
  assert.match(chrome, /startRefreshTransition\(\(\) => router\.refresh\(\)\)/);
  assert.match(chrome, /disabled=\{refreshBusy\}/);
  assert.doesNotMatch(
    chrome,
    /label:\s*['"`](Stats|Export|Invite|New|Signal)['"`]/,
  );

  assert.match(inbox, /label: `Open current \$\{itemTypeLabel\}`/);
  assert.match(inbox, /onClick: openCurrentDetail/);
  assert.match(
    overview,
    /label: `Open \$\{selectedQueue\.label\.toLowerCase\(\)\} context`/,
  );
  assert.match(overview, /onClick: openSelectedQueueContext/);
});

test("the Ops shell owns the viewport while each workspace owns its scroll", async () => {
  const root = process.cwd();
  const [layout, chrome, shellCss, adaptiveCss] = await Promise.all([
    readFile(path.join(root, "app/(ops)/layout.tsx"), "utf8"),
    readFile(path.join(root, "components/ops/shell/OpsChrome.tsx"), "utf8"),
    readFile(path.join(root, "app/(ops)/ops.module.css"), "utf8"),
    readFile(
      path.join(root, "components/ops/shell/ops-tablet.module.css"),
      "utf8",
    ),
  ]);

  // A duplicate viewport wrapper lets scrollable route content enlarge the
  // document even when the visible shell itself is clipped.
  assert.doesNotMatch(layout, /className=\{styles\.body\}/);
  assert.equal((chrome.match(/className=\{styles\.body\}/g) ?? []).length, 1);

  // The private canvas paints through device insets. Floating compact chrome
  // then applies the safe-area clearance instead of leaving an unpainted strip.
  assert.match(
    layout,
    /export const viewport: Viewport = \{\s*viewportFit: 'cover',?\s*\};/,
  );

  const viewportRoot = shellCss.match(/\.body\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  assert.match(viewportRoot, /position:\s*fixed;/);
  assert.match(viewportRoot, /inset:\s*0;/);
  assert.match(viewportRoot, /height:\s*100dvh;/);
  assert.match(viewportRoot, /overflow:\s*clip;/);

  assert.match(
    shellCss,
    /\.main\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/,
  );
  assert.match(
    adaptiveCss,
    /\.contentWrapper\s*\{[\s\S]*?height:\s*100dvh\s*!important;[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?overflow:\s*clip;/,
  );
  assert.match(
    adaptiveCss,
    /\.tabletIsland\s*\{[\s\S]*?top:\s*max\(var\(--space-3\), env\(safe-area-inset-top\)\);/,
  );
  assert.match(
    adaptiveCss,
    /\.menuFab\s*\{[\s\S]*?top:\s*max\(var\(--space-3\), env\(safe-area-inset-top\)\);/,
  );
});

test("Ops workspace headers stay single-line and never narrate route state", async () => {
  const root = process.cwd();
  const [overview, loading] = await Promise.all([
    readFile(path.join(root, "app/(ops)/ops/OverviewBriefing.tsx"), "utf8"),
    readFile(path.join(root, "app/(ops)/ops/loading.tsx"), "utf8"),
  ]);
  const header =
    overview.match(
      /<header className=\{styles\.context\}>[\s\S]*?<\/header>/,
    )?.[0] ?? "";

  assert.match(header, /<h1 id="overview-heading">Overview<\/h1>/);
  assert.doesNotMatch(
    header,
    /<p>|pendingTotal|RelativeTime|awaiting review|Updated/,
  );
  assert.doesNotMatch(loading, /skeletonText/);
});

test("the Observations fallback follows the resolved inspector contract, not URL timing", async () => {
  const root = process.cwd();
  const [loading, inbox] = await Promise.all([
    readFile(path.join(root, "app/(ops)/ops/observations/loading.tsx"), "utf8"),
    readFile(
      path.join(root, "components/ops/inbox/InboxContainer.tsx"),
      "utf8",
    ),
  ]);

  // The ready inbox selects the first available record when no URL selection
  // exists, so desktop loading must reserve that inspector before `?id=` is
  // written. URL timing is not a reliable loading-state contract.
  assert.match(inbox, /onSelect\(optimisticItems\[0\], 0\);/);
  assert.doesNotMatch(loading, /useSearchParams|searchParams|selectedId/);
  assert.match(
    loading,
    /window\.matchMedia\('\(min-width: 1180px\)'\)\.matches/,
  );
  assert.match(loading, /<DetailSkeleton \/>/);
  assert.match(
    loading,
    /createPortal\(<ObservationDetailSkeleton announce=\{false\} \/>/,
  );

  // Compact inspectors remain interaction-driven sheets. The route fallback
  // must not invent an open dialog while the ready state keeps it closed.
  assert.doesNotMatch(loading, /role="dialog"|aria-modal="true"|tabletStage/);
});
