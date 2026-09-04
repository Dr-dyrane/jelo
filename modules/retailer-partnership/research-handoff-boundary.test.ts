import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { retailerPartnershipApprovalResearchBoundary } from "@/lib/retailer-partnership/research-handoff-boundary";

test("retailer approval remains private and noncanonical until a typed research handoff exists", async () => {
  assert.deepEqual(retailerPartnershipApprovalResearchBoundary, {
    approvalEffect: "application-status-only",
    researchHandoff: "blocked",
    blocker: "community-research-requires-community-or-customer-signal",
    canonicalWrite: false,
    includesPii: false,
    publicClaim: false,
  });

  const root = process.cwd();
  const transitions = await readFile(
    path.join(root, "lib/moderation/database-transitions.ts"),
    "utf8",
  );
  const start = transitions.indexOf(
    "export function decideRetailerApplication(",
  );
  const end = transitions.indexOf(
    "export async function moderationTargetExists(",
    start,
  );
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const approvalTransition = transitions.slice(start, end);

  assert.match(
    approvalTransition,
    /transition\(\s*sql,\s*["']retailer_application["']/,
  );
  assert.match(
    approvalTransition,
    /update retailer_partnership_applications set status = \$\{status\}/,
  );
  assert.doesNotMatch(
    approvalTransition,
    /insert into (?:community_research_tasks|community_research_task_mentions|retailers|retailer_locations)/i,
  );

  const researchMigration = await readFile(
    path.join(root, "db/migrations/0017_community_first_research_queue.sql"),
    "utf8",
  );
  assert.match(
    researchMigration,
    /priority_lane text not null default 'community-first'/,
  );
  assert.match(
    researchMigration,
    /contribution_id uuid not null references community_contributions\(id\)/,
  );
});
