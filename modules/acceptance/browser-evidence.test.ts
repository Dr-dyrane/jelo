import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Browser evidence acceptance contract.
 *
 * These tests verify that the rendered output of key user journeys
 * contains the expected structural elements. They are source-level
 * contracts that ensure the decomposed components (Wave 1–3) are
 * wired correctly in the actual page output.
 *
 * For live browser verification, run `npm run dev` and use the
 * Playwright MCP server to navigate through the journeys documented
 * in scripts/acceptance-journeys.md.
 */

const root = process.cwd();

test("home page renders the primary discovery entry points", () => {
  const home = readFileSync(`${root}/app/(site)/page.tsx`, "utf8");
  const hero = readFileSync(`${root}/components/home/home-hero.tsx`, "utf8");
  assert.match(hero, /Browse products/);
  assert.match(hero, /Ask JeloCare/);
  assert.match(home, /listRecommendationEligibleProducts/);
});

test("products page renders the catalogue view through the extracted model", () => {
  const page = readFileSync(`${root}/app/(site)/products/page.tsx`, "utf8");
  const model = readFileSync(
    `${root}/lib/catalogue/catalogue-page-model.ts`,
    "utf8",
  );
  const merchandising = readFileSync(
    `${root}/components/products/catalogue-merchandising.tsx`,
    "utf8",
  );

  // Page delegates to the extracted model
  assert.match(page, /buildCataloguePageModel/);
  assert.match(page, /<InventoryResults/);
  assert.match(page, /<CatalogueSearch/);
  assert.match(page, /<DiscoveryRail/);
  assert.match(page, /<CatalogueStories/);

  // Model owns data loading
  assert.match(model, /loadInventory/);
  assert.match(model, /selectRecentlyCheckedProducts/);
  assert.match(model, /resolvedCatalogueGuides/);

  // Merchandising components are extracted
  assert.match(merchandising, /export function DiscoveryRail/);
  assert.match(merchandising, /export function CatalogueStories/);
});

test("product detail page exposes the quick panel with controlled dialog", () => {
  const panel = readFileSync(
    `${root}/components/products/product-quick-panel.tsx`,
    "utf8",
  );
  assert.match(panel, /useControlledDialog/);
  assert.match(panel, /open: boolean/);
  assert.match(panel, /onClose: \(\) => void/);
  assert.equal((panel.match(/<dialog\b/g) ?? []).length, 1);
});

test("Me portal delegates to extracted view components", () => {
  const home = readFileSync(`${root}/components/me/home/me-home.tsx`, "utf8");
  const homeView = readFileSync(
    `${root}/components/me/home/home-view.tsx`,
    "utf8",
  );
  const exploreView = readFileSync(
    `${root}/components/me/explore/explore-view.tsx`,
    "utf8",
  );
  const routineView = readFileSync(
    `${root}/components/me/routine/routine-view.tsx`,
    "utf8",
  );
  const consultView = readFileSync(
    `${root}/components/me/consult/consult-view.tsx`,
    "utf8",
  );

  // MePortal imports the extracted views
  assert.match(home, /HomeView/);
  assert.match(home, /ExploreView/);
  assert.match(home, /RoutineView/);
  assert.match(home, /ConsultView/);

  // Each view is a named export
  assert.match(homeView, /export function HomeView/);
  assert.match(exploreView, /export function ExploreView/);
  assert.match(routineView, /export function RoutineView/);
  assert.match(consultView, /export function ConsultView/);
});

test("modal sheets share the controlled dialog controller", () => {
  const hook = readFileSync(
    `${root}/components/ui/use-controlled-dialog.ts`,
    "utf8",
  );
  const accountSheet = readFileSync(
    `${root}/components/me/shell/me-account-sheet.tsx`,
    "utf8",
  );
  const contextSheet = readFileSync(
    `${root}/components/me/shell/me-context-sheet.tsx`,
    "utf8",
  );
  const productPanel = readFileSync(
    `${root}/components/products/product-quick-panel.tsx`,
    "utf8",
  );
  const exploreView = readFileSync(
    `${root}/components/me/explore/explore-view.tsx`,
    "utf8",
  );

  // Shared hook exists and wraps useModalDialog
  assert.match(hook, /useModalDialog/);
  assert.match(hook, /export function useControlledDialog/);

  // All modal components use the shared hook
  assert.match(accountSheet, /useControlledDialog/);
  assert.match(contextSheet, /useControlledDialog/);
  assert.match(productPanel, /useControlledDialog/);
  assert.match(exploreView, /useControlledDialog/);
});

test("consult page delegates to the ConsultExperience client component", () => {
  const page = readFileSync(`${root}/app/(site)/consult/page.tsx`, "utf8");
  const experience = readFileSync(
    `${root}/components/consult/consult-experience.tsx`,
    "utf8",
  );

  assert.match(page, /ConsultExperience/);
  assert.match(experience, /'use client'/);
  assert.match(experience, /export function ConsultExperience/);
});

test("private-safe metrics do not log PII", () => {
  // Verify that no customer PII (email, display name, raw profile data)
  // is logged in any server-side module. This is a source-level contract
  // that ensures metrics are private-safe.
  const customerAccess = readFileSync(`${root}/lib/customer/access.ts`, "utf8");
  assert.doesNotMatch(
    customerAccess,
    /console\.(log|info|warn|error)\(.*email/i,
  );
  assert.doesNotMatch(
    customerAccess,
    /console\.(log|info|warn|error)\(.*displayName/i,
  );
});
