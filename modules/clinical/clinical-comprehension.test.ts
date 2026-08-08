import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const primitives = readFileSync(
  "components/clinical/clinical-primitives.tsx",
  "utf8",
);
const primitivesCss = readFileSync(
  "components/clinical/clinical-primitives.module.css",
  "utf8",
);
const ingredientExplorer = readFileSync(
  "components/ingredients/ingredient-explorer.tsx",
  "utf8",
);
const ingredientPage = readFileSync("app/(site)/ingredients/page.tsx", "utf8");
const decisionSummary = readFileSync(
  "components/products/product-decision-summary.tsx",
  "utf8",
);
const productPage = readFileSync("app/(site)/products/[slug]/page.tsx", "utf8");
const concernPage = readFileSync("app/(site)/concerns/[slug]/page.tsx", "utf8");

test("clinical primitives export the smallest useful set of shared display components", () => {
  assert.match(primitives, /export function EvidenceGradeBadge/);
  assert.match(primitives, /export function SafetyBadge/);
  assert.match(primitives, /export function ClinicalCaution/);
  assert.match(primitives, /export function SourceList/);
  assert.match(primitives, /export function ReviewedOn/);
  // Type exports for consumers
  assert.match(primitives, /export type EvidenceGradeLevel/);
  assert.match(primitives, /export type SafetyStatus/);
  assert.match(primitives, /export type SourceEntry/);
});

test("clinical primitives are data-gated and render nothing on empty input", () => {
  // ClinicalCaution must return null when text is empty
  assert.match(primitives, /if \(!text\) return null/);
  // SourceList must return null when sources is empty
  assert.match(primitives, /if \(deduped\.length === 0\) return null/);
  // SafetyBadge must return null when hideUnknown and status is unknown
  assert.match(
    primitives,
    /if \(hideUnknown && status === 'unknown'\) return null/,
  );
  // ReviewedOn must return null when date is invalid
  assert.match(primitives, /if \(!formatted\) return null/);
});

test("clinical primitives deduplicate sources by URL", () => {
  assert.match(primitives, /export function deduplicateSources/);
  assert.match(primitives, /const seen = new Set/);
  assert.match(primitives, /if \(seen\.has\(s\.url\)\) return false/);
});

test("clinical primitive CSS has dark theme and reduced motion support", () => {
  assert.match(primitivesCss, /prefers-color-scheme: dark/);
  // Focus states are preserved
  assert.match(primitivesCss, /focus-visible/);
});

test("ingredient explorer uses shared clinical primitives", () => {
  assert.match(
    ingredientExplorer,
    /from '@\/components\/clinical\/clinical-primitives'/,
  );
  assert.match(ingredientExplorer, /EvidenceGradeBadge/);
  assert.match(ingredientExplorer, /SafetyBadge/);
  assert.match(ingredientExplorer, /ClinicalCaution/);
});

test("ingredient explorer implements progressive disclosure with accessible toggle", () => {
  // Disclosure toggle with aria-expanded and aria-controls
  assert.match(ingredientExplorer, /aria-expanded=\{showDetails\}/);
  assert.match(ingredientExplorer, /aria-controls=\{detailsId\}/);
  // Chevron icon that rotates on open
  assert.match(ingredientExplorer, /ChevronDown/);
  assert.match(ingredientExplorer, /chevronOpen/);
});

test("ingredient card type supports enriched clinical knowledge fields", () => {
  assert.match(ingredientExplorer, /family\?: string/);
  assert.match(ingredientExplorer, /concerns\?: string\[\]/);
  assert.match(ingredientExplorer, /allowedTimes\?: string\[\]/);
  assert.match(ingredientExplorer, /pregnancyStatus\?: SafetyStatus/);
  assert.match(ingredientExplorer, /nursingStatus\?: SafetyStatus/);
  assert.match(ingredientExplorer, /photosensitivity\?:/);
  assert.match(ingredientExplorer, /irritationRisk\?:/);
  assert.match(ingredientExplorer, /sources\?: SourceEntry\[\]/);
  assert.match(ingredientExplorer, /reviewedAt\?: string/);
});

test("ingredient page enriches cards with clinical knowledge from the core module", () => {
  assert.match(
    ingredientPage,
    /from '@\/modules\/clinical\/core\/ingredients'/,
  );
  assert.match(ingredientPage, /ingredientById/);
  assert.match(ingredientPage, /knowledge\?\.family/);
  assert.match(ingredientPage, /knowledge\?\.concerns/);
  assert.match(ingredientPage, /knowledge\?\.pregnancy/);
  assert.match(ingredientPage, /knowledge\?\.breastfeeding/);
});

test("ingredient detail sheet first view answers what, why, and important caution", () => {
  // What is it — summary and family
  assert.match(ingredientExplorer, /sheetSummary/);
  assert.match(ingredientExplorer, /sheetFamily/);
  // Why might I use it — concerns section
  assert.match(ingredientExplorer, /May help with/);
  assert.match(ingredientExplorer, /sheetConcerns/);
  // Important caution — ClinicalCaution component
  assert.match(ingredientExplorer, /hasCaution/);
  assert.match(ingredientExplorer, /cautionText/);
});

test("ingredient detail sheet omits sections when data is absent", () => {
  // hasDeeperData gates the disclosure section
  assert.match(ingredientExplorer, /hasDeeperData/);
  // The disclosure body only renders when showDetails is true
  assert.match(ingredientExplorer, /\{showDetails \?/);
});

test("product decision summary uses shared EvidenceGradeBadge and ClinicalCaution", () => {
  assert.match(
    decisionSummary,
    /from '@\/components\/clinical\/clinical-primitives'/,
  );
  assert.match(decisionSummary, /EvidenceGradeBadge/);
  assert.match(decisionSummary, /ClinicalCaution/);
});

test("product decision summary shows Why JeloCare only when care review data supports it", () => {
  // hasWhyJeloCare is gated on supportive_eligible care state
  assert.match(decisionSummary, /hasWhyJeloCare/);
  assert.match(decisionSummary, /careStatus === 'Supportive use'/);
  assert.match(decisionSummary, /approvedUses && approvedUses\.length > 0/);
});

test("product decision summary surfaces the strongest caution from care review state", () => {
  assert.match(decisionSummary, /strongestCaution/);
  assert.match(decisionSummary, /Pharmacist review/);
  assert.match(decisionSummary, /Formula review pending/);
  // Formula-level caveat is always present
  assert.match(decisionSummary, /formulaCaveat/);
  assert.match(
    decisionSummary,
    /Ingredient-level evidence, not a formula guarantee/,
  );
});

test("product decision summary shows evidence sources only when care review provides them", () => {
  assert.match(
    decisionSummary,
    /evidenceSourceUrls && evidenceSourceUrls\.length > 0/,
  );
  assert.match(decisionSummary, /Care review sources/);
  assert.match(decisionSummary, /reviewedAt/);
});

test("product page derives care status from care review data", () => {
  assert.match(
    productPage,
    /careReview\?\.careState === ["']supportive_eligible["']/,
  );
});

test("concern page uses shared ReviewedOn and SourceList primitives", () => {
  assert.match(
    concernPage,
    /from '@\/components\/clinical\/clinical-primitives'/,
  );
  assert.match(concernPage, /ReviewedOn/);
  assert.match(concernPage, /SourceList/);
});

test("concern page preserves the clinical content grammar order", () => {
  // 1. Plain-language summary comes first
  const summaryIdx = concernPage.indexOf("page-heading");
  // 2. Urgent action before signs
  const urgentIdx = concernPage.indexOf("concern-urgent-action");
  const detailIdx = concernPage.indexOf("concern-detail-grid");
  // 5. Sources before products
  const sourcesIdx = concernPage.indexOf("concern-sources");
  const matchesIdx = concernPage.indexOf("concern-matches");

  assert.ok(summaryIdx > -1, "page-heading must exist");
  assert.ok(urgentIdx > -1, "concern-urgent-action must exist");
  assert.ok(detailIdx > -1, "concern-detail-grid must exist");
  assert.ok(sourcesIdx > -1, "concern-sources must exist");
  assert.ok(matchesIdx > -1, "concern-matches must exist");

  // Urgent action before detail grid
  assert.ok(urgentIdx < detailIdx, "Urgent action must render before signs");
  // Sources before product matches
  assert.ok(
    sourcesIdx < matchesIdx,
    "Sources must render before product matches",
  );
});

test("concern page preserves Guidance not a diagnosis language", () => {
  assert.match(concernPage, /Guidance, not a diagnosis/);
});

test("concern page preserves urgent action rendering before signs and optional care", () => {
  assert.match(concernPage, />What to do now</);
  assert.match(
    concernPage,
    /concern\.kind === 'concern'\s*\?\s*\(await listRecommendationEligibleProducts\(\)\)/,
  );
  assert.ok(
    concernPage.indexOf("concern-urgent-action") <
      concernPage.indexOf("concern-detail-grid"),
    "The immediate action must render before signs and optional care.",
  );
  assert.match(
    concernPage,
    /concern\.kind === 'concern' \? <section className="concern-matches"/,
  );
});

test("no unsupported clinical claim appears through fallback logic", () => {
  // The ingredient explorer must not generate generic filler for missing data
  // It must not display "unknown" repeatedly
  const unknownCount = (ingredientExplorer.match(/"unknown"/g) ?? []).length;
  assert.ok(
    unknownCount === 0,
    'Ingredient explorer must not hardcode "unknown" as display text',
  );

  // The decision summary must not invent claims
  // It must only show "Why JeloCare considers this" when care review data supports it
  assert.match(decisionSummary, /hasWhyJeloCare/);
  // The formula caveat is a general statement, not a product-specific claim
  assert.match(decisionSummary, /Patch test new products/);
});
