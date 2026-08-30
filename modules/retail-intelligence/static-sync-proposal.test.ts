import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mergeStaticSyncProposal,
  StaticSyncProposalValidationError,
  validateStaticSyncProposal,
} from "@/lib/inventory/static-sync-proposal";

const baseContent = `import type { Offer } from "@/data/products";

const checkedAt = "2026-08-20T00:00:00Z";
const exactNg = (...args: unknown[]): Offer => args as unknown as Offer;

export const verifiedRetailOffers: Record<string, Offer[]> = {
  "alpha-100ml": [
    exactNg(
      "Retailer A",
      "https://retailer.example/alpha",
      90,
      10000,
      "Alpha",
      "100 ml",
      {
        observedAt: "2026-08-20T00:00:00Z",
        expiresAt: "2026-08-27T00:00:00Z",
        sellerName: "Retailer A",
      },
    ),
  ],
  "beta-50g": [
    exactNg(
      "Retailer B",
      "https://retailer.example/beta",
      80,
      20000,
      "Beta",
      "50 g",
      {
        observedAt: "2026-08-20T00:00:00Z",
        expiresAt: "2026-08-27T00:00:00Z",
      },
    ),
  ],
};
`;

function proposal(replacements: Array<[string, string]>) {
  return replacements.reduce(
    (content, [before, after]) => content.replace(before, after),
    baseContent,
  );
}

function rejects(candidateContent: string, pattern: RegExp) {
  assert.throws(
    () => validateStaticSyncProposal({ baseContent, candidateContent }),
    (error: unknown) =>
      error instanceof StaticSyncProposalValidationError &&
      pattern.test(error.message),
  );
}

function refreshedAlpha() {
  return proposal([
    ["10000,", "12000,"],
    [
      'observedAt: "2026-08-20T00:00:00Z",\n        expiresAt: "2026-08-27T00:00:00Z",',
      'observedAt: "2026-08-30T00:00:00Z",\n        expiresAt: "2026-09-04T00:00:00Z",\n        available: true,\n        stock: "in-stock",\n        verificationMethod: "retailer_page",',
    ],
  ]);
}

test("accepts a bounded retailer-page refresh", () => {
  const candidateContent = refreshedAlpha();

  assert.deepEqual(
    validateStaticSyncProposal({ baseContent, candidateContent }),
    {
      changedOffers: 1,
      refreshedOffers: 1,
      invalidatedOffers: 0,
      offerKeys: ["alpha-100ml :: Retailer A #1"],
    },
  );
});

test("accepts a terminal invalidation that only shortens freshness", () => {
  const candidateContent = proposal([
    [
      'expiresAt: "2026-08-27T00:00:00Z",\n        sellerName:',
      'expiresAt: "2026-08-22T00:00:00Z",\n        available: false,\n        stock: "unknown",\n        sellerName:',
    ],
  ]);

  const result = validateStaticSyncProposal({ baseContent, candidateContent });
  assert.equal(result.refreshedOffers, 0);
  assert.equal(result.invalidatedOffers, 1);
});

test("rejects identity, URL, size, or protected option changes", () => {
  rejects(
    proposal([
      ["https://retailer.example/alpha", "https://evil.example/alpha"],
    ]),
    /protected exactNg argument 2/,
  );
  rejects(proposal([["100 ml", "110 ml"]]), /protected exactNg argument 6/);
  rejects(
    proposal([['sellerName: "Retailer A"', 'sellerName: "Someone Else"']]),
    /protected option sellerName/,
  );
});

test("rejects refreshes outside price and freshness bounds", () => {
  const refreshed = proposal([
    ["10000,", "14000,"],
    [
      'observedAt: "2026-08-20T00:00:00Z",\n        expiresAt: "2026-08-27T00:00:00Z",',
      'observedAt: "2026-08-30T00:00:00Z",\n        expiresAt: "2026-09-06T00:00:01Z",\n        available: true,\n        stock: "in-stock",\n        verificationMethod: "retailer_page",',
    ],
  ]);
  rejects(refreshed, /verification window/);

  rejects(
    refreshed
      .replace("14000,", "15000,")
      .replace(
        'expiresAt: "2026-09-06T00:00:01Z"',
        'expiresAt: "2026-09-04T00:00:00Z"',
      ),
    /price change exceeds 35%/,
  );
});

test("rejects terminal invalidations that change price or extend freshness", () => {
  rejects(
    proposal([
      ["10000,", "11000,"],
      [
        'sellerName: "Retailer A",',
        'available: false,\n        stock: "unknown",\n        sellerName: "Retailer A",',
      ],
    ]),
    /terminal invalidation changes price/,
  );
  rejects(
    proposal([
      [
        'sellerName: "Retailer A",',
        'available: false,\n        stock: "unknown",\n        sellerName: "Retailer A",',
      ],
      ["2026-08-27T00:00:00Z", "2026-08-28T00:00:00Z"],
    ]),
    /extends freshness/,
  );
});

test("rejects added, removed, or reordered offers", () => {
  rejects(
    proposal([['\n  "beta-50g": [', '\n  "renamed-beta-50g": [']]),
    /product structure|adds, removes, or reorders/,
  );
  rejects(
    proposal([
      [
        '  "beta-50g": [',
        '  "beta-50g": [\n    exactNg("Extra", "https://example.com", 70, 1, "Extra", "1 g"),',
      ],
    ]),
    /product structure|adds, removes, or reorders/,
  );
});

test("rejects changes outside verifiedRetailOffers", () => {
  rejects(
    proposal([["const checkedAt", "// unrelated\nconst checkedAt"]]),
    /outside verifiedRetailOffers/,
  );
});

test("rejects an empty or formatting-only proposal", () => {
  rejects(baseContent, /contains no static offer changes/);
  rejects(
    proposal([['      "Retailer A",', "      'Retailer A',"]]),
    /protected exactNg argument 1/,
  );
});

test("history merge applies a refresh over independent current-tree changes", () => {
  const currentContent = proposal([
    [
      '  "beta-50g": [',
      '  "gamma-30ml": [\n    exactNg("Retailer C", "https://retailer.example/gamma", 75, 9000, "Gamma", "30 ml"),\n  ],\n  "beta-50g": [',
    ],
  ]);
  const result = mergeStaticSyncProposal({
    baseContent,
    currentContent,
    proposalContent: refreshedAlpha(),
  });
  assert.equal(result.applied, 1);
  assert.equal(result.staleSkipped, 0);
  assert.match(result.content, /"gamma-30ml"/);
  assert.match(result.content, /12000,/);
  assert.match(result.content, /verificationMethod: "retailer_page"/);
});

test("history merge adds bounded evidence options to a six-argument offer", () => {
  const sixArgumentBase = baseContent.replace(
    `,
      {
        observedAt: "2026-08-20T00:00:00Z",
        expiresAt: "2026-08-27T00:00:00Z",
      }`,
    "",
  );
  const proposalContent = sixArgumentBase.replace(
    `      "Beta",
      "50 g",
    )`,
    `      "Beta",
      "50 g",
      {
        observedAt: "2026-08-30T00:00:00Z",
        expiresAt: "2026-09-04T00:00:00Z",
        available: true,
        stock: "in-stock",
        verificationMethod: "retailer_page",
      },
    )`,
  );
  const result = mergeStaticSyncProposal({
    baseContent: sixArgumentBase,
    currentContent: sixArgumentBase,
    proposalContent,
  });
  assert.equal(result.applied, 1);
  assert.match(
    result.content,
    /"Beta",\s+"50 g",\s+\{[\s\S]*verificationMethod: "retailer_page"/,
  );
});

test("history merge treats newer current evidence as authoritative", () => {
  const currentContent = refreshedAlpha()
    .replace("12000,", "12500,")
    .replaceAll("2026-08-30T00:00:00Z", "2026-09-01T00:00:00Z")
    .replace("2026-09-04T00:00:00Z", "2026-09-06T00:00:00Z");
  const result = mergeStaticSyncProposal({
    baseContent,
    currentContent,
    proposalContent: refreshedAlpha(),
  });
  assert.equal(result.applied, 0);
  assert.equal(result.staleSkipped, 1);
  assert.equal(result.content, currentContent);
});

test("history merge lets a deliberate main removal supersede an old refresh", () => {
  const currentContent = baseContent.replace(
    /  "alpha-100ml": \[[\s\S]*?\n  \],\n  "beta-50g":/,
    '  "alpha-100ml": [],\n  "beta-50g":',
  );
  const result = mergeStaticSyncProposal({
    baseContent,
    currentContent,
    proposalContent: refreshedAlpha(),
  });
  assert.equal(result.applied, 0);
  assert.equal(result.removedSkipped, 1);
  assert.equal(result.content, currentContent);
});

test("history merge applies terminal state but never retargets identity", () => {
  const terminalProposal = proposal([
    [
      'expiresAt: "2026-08-27T00:00:00Z",\n        sellerName:',
      'expiresAt: "2026-08-22T00:00:00Z",\n        available: false,\n        stock: "unknown",\n        sellerName:',
    ],
  ]);
  const merged = mergeStaticSyncProposal({
    baseContent,
    currentContent: baseContent.replace("20000,", "20500,"),
    proposalContent: terminalProposal,
  });
  assert.equal(merged.applied, 1);
  assert.match(merged.content, /available: false/);
  assert.match(merged.content, /stock: "unknown"/);
  assert.throws(
    () =>
      mergeStaticSyncProposal({
        baseContent,
        currentContent: baseContent.replace(
          "https://retailer.example/alpha",
          "https://retailer.example/replacement",
        ),
        proposalContent: terminalProposal,
      }),
    /identity conflicts require review/,
  );
});

test("history merge rejects same-timestamp disagreements", () => {
  const currentContent = refreshedAlpha().replace("12000,", "11000,");
  assert.throws(
    () =>
      mergeStaticSyncProposal({
        baseContent,
        currentContent,
        proposalContent: refreshedAlpha(),
      }),
    /divergent evidence at the same observation time/,
  );
});

test("workflow serializes, gates, and atomically advances the exact review branch", () => {
  const workflow = readFileSync(
    ".github/workflows/inventory-static-integration.yml",
    "utf8",
  );
  assert.match(workflow, /branches:\s*\n\s*- inventory-sync-review/);
  assert.match(workflow, /group: inventory-static-integration/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /inventory:static-proposal:validate/);
  assert.match(workflow, /inventory:static-proposal:merge/);
  assert.match(workflow, /git merge-base/);
  assert.match(workflow, /npm run verify:release/);
  assert.match(workflow, /npm run verify:research-integrity/);
  assert.match(workflow, /SKIP_DATABASE_MIGRATIONS: ["']1["']/);
  assert.match(workflow, /git push --atomic/);
  assert.match(
    workflow,
    /--force-with-lease=["']refs\/heads\/inventory-sync-review:/,
  );
  assert.doesNotMatch(workflow, /api\/cron\/inventory|inventory:work/);
  assert.doesNotMatch(workflow, /git rebase/);
});
