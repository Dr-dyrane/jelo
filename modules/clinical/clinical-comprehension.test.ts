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
const ingredientLibrary = readFileSync(
  "lib/clinical/ingredient-library.ts",
  "utf8",
);
const decisionSummary = readFileSync(
  "components/products/product-decision-summary.tsx",
  "utf8",
);
const productPanelModel = readFileSync(
  "lib/catalogue/product-panel-model.ts",
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
    /from (?:'@\/components\/clinical\/clinical-primitives'|"@\/components\/clinical\/clinical-primitives")/,
  );
  assert.match(ingredientExplorer, /EvidenceGradeBadge/);
  assert.match(ingredientExplorer, /SafetyBadge/);
  assert.match(ingredientExplorer, /ClinicalCaution/);
});

test("ingredient explorer implements progressive disclosure with accessible toggle", () => {
  // Disclosure toggle with aria-expanded and aria-controls
  assert.match(
    ingredientExplorer,
    /aria-expanded=\{openSlug === ingredient\.slug\}/,
  );
  assert.match(ingredientExplorer, /aria-controls=\{dialogId\}/);
  // Dialog semantics and arrow icon on the toggle
  assert.match(ingredientExplorer, /aria-haspopup="dialog"/);
  assert.match(ingredientExplorer, /ArrowRight/);
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
    ingredientLibrary,
    /from "@\/modules\/clinical\/core\/ingredients"/,
  );
  assert.match(ingredientLibrary, /ingredientById/);
  assert.match(ingredientLibrary, /knowledge\?\.family/);
  assert.match(ingredientLibrary, /knowledge\?\.concerns/);
  assert.match(ingredientLibrary, /knowledge\?\.pregnancy/);
  assert.match(ingredientLibrary, /knowledge\?\.breastfeeding/);
  assert.match(ingredientPage, /await listCatalogueProducts\(\)/);
});

test("ingredient detail sheet first view answers what, why, and important caution", () => {
  // What is it — summary and family
  assert.match(ingredientExplorer, /sheetSummary/);
  assert.match(ingredientExplorer, /familyLabels/);
  // Why might I use it — concerns section
  assert.match(ingredientExplorer, /Related care guides/);
  assert.match(ingredientExplorer, /relatedSection/);
  // Important caution — ClinicalCaution component
  assert.match(ingredientExplorer, /hasCaution/);
  assert.match(ingredientExplorer, /cautionText/);
});

test("ingredient detail sheet omits sections when data is absent", () => {
  // concernLinks.length gates the related care guides section
  assert.match(ingredientExplorer, /concernLinks\.length \?/);
  // detailRows.length gates the detail list rendering
  assert.match(ingredientExplorer, /detailRows\.length \?/);
});

test("product care decision maps every canonical state without catalogue-copy fallback", () => {
  assert.match(
    productPanelModel,
    /careReview\?\.careState \?\? ["']insufficient_data["']/,
  );
  assert.match(productPanelModel, /state === ["']supportive_eligible["']/);
  assert.match(productPanelModel, /Reviewed supportive use/);
  assert.match(productPanelModel, /state === ["']pharmacist_review["']/);
  assert.match(productPanelModel, /Pharmacist-reviewed context/);
  assert.match(productPanelModel, /reviewed context only/);
  assert.match(productPanelModel, /pharmacyAttestation/);
  assert.match(productPanelModel, /Supportive use not confirmed/);
  assert.doesNotMatch(productPanelModel, /product\.displayLine/);
});

test("insufficient product copy denies concern and skin-type support", () => {
  assert.match(
    productPanelModel,
    /haven't confirmed this exact product for a particular concern or skin type yet/,
  );
  assert.match(
    productPanelModel,
    /statusLabel: ["']Supportive use not confirmed["'][\s\S]*?approvedUses: \[\]/,
  );
  assert.match(productPanelModel, /Tell Jelo what I'm noticing/);
  assert.match(productPanelModel, /What I'm noticing is:/);
  assert.doesNotMatch(productPanelModel, /Ask Jelo to check how it fits/);
  assert.doesNotMatch(decisionSummary, /concernFit|ingredients/);
});

test("approved-use claims render only for supportive eligible products", () => {
  assert.match(
    decisionSummary,
    /decision\.state === ["']supportive_eligible["']/,
  );
  assert.match(decisionSummary, /showsApprovedUses \?/);
  assert.match(decisionSummary, /decision\.approvedUses\.join/);
});

test("product decision summary exposes exact review dates and source links", () => {
  assert.match(decisionSummary, /<time dateTime=\{decision\.reviewedAt\}>/);
  assert.match(decisionSummary, /Product evidence reviewed/);
  assert.match(decisionSummary, /: ["']Reviewed ["']/);
  assert.match(decisionSummary, /Pharmacy approval by/);
  assert.match(decisionSummary, /decision\.pharmacyAttestation\.approvedAt/);
  assert.match(decisionSummary, /day: ["']numeric["']/);
  assert.match(decisionSummary, /timeZone: ["']UTC["']/);
  assert.match(decisionSummary, /href=\{url\}/);
  assert.match(decisionSummary, /Care review sources/);
  assert.match(decisionSummary, /href=\{decision\.nextAction\.href\}/);
  assert.match(decisionSummary, /decision\.nextAction\.label/);
  assert.match(decisionSummary, /formatProductCareSourceLabel\(url\)/);
});

test("public product page keeps care evidence out of the default commerce hero", () => {
  assert.match(productPage, /<ProductHeroMotion/);
  assert.doesNotMatch(productPage, /<ProductDecisionSummary/);
  assert.doesNotMatch(productPage, /careStatus=/);
  assert.match(
    productPage,
    /<ProductQuickPanel[\s\S]*?\{\.\.\.panelData\}[\s\S]*?\/>/,
  );
  assert.doesNotMatch(
    productPage,
    /isPublishedIntakeProduct|getReviewedProductCare/,
  );
});

test("concern page uses shared ReviewedOn and SourceList primitives", () => {
  assert.match(
    concernPage,
    /from (?:'@\/components\/clinical\/clinical-primitives'|"@\/components\/clinical\/clinical-primitives")/,
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
    /concern\.kind === (?:'concern'|"concern")\s*\?\s*productsLinkedToConcern\(await listCatalogueProducts\(\), concern\)/,
  );
  assert.match(concernPage, /Reviewed product context/);
  assert.match(concernPage, /they are not\s+direct recommendations/);
  assert.ok(
    concernPage.indexOf("concern-urgent-action") <
      concernPage.indexOf("concern-detail-grid"),
    "The immediate action must render before signs and optional care.",
  );
  assert.match(
    concernPage,
    /concern\.kind === (?:'concern'|"concern")\s*\?\s*\(\s*<section className="concern-matches"/,
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

  // The product surface must not turn catalogue prose, concern matching, or
  // ingredient presence into care support.
  assert.doesNotMatch(productPanelModel, /product\.displayLine/);
  assert.doesNotMatch(decisionSummary, /concernFit|ingredients/);
  assert.match(
    decisionSummary,
    /decision\.state === ["']supportive_eligible["']/,
  );
});
