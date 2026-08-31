import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  "components/products/product-quick-panel.tsx",
  "utf8",
);
const model = readFileSync("lib/catalogue/product-panel-model.ts", "utf8");
const productPage = readFileSync("app/(site)/products/[slug]/page.tsx", "utf8");
const panelStyles = readFileSync("app/product-panel.css", "utf8");

test("the product panel exposes one controlled dialog with a stable accessible tab contract", () => {
  assert.equal(component.match(/<dialog\b/g)?.length, 1);
  assert.match(component, /export function ProductQuickPanelSheet/);
  assert.match(component, /open: boolean/);
  assert.match(component, /tab: ProductPanelTab/);
  assert.match(component, /onTabChange: \(tab: ProductPanelTab\) => void/);
  assert.match(component, /onClose: \(\) => void/);
  assert.match(component, /restoreFocusRef\?: RefObject<HTMLElement \| null>/);
  assert.match(
    component,
    /aria-controls={`\$\{dialogId\}-panel-\$\{item\.id\}`}/,
  );
  assert.match(component, /aria-labelledby={`\$\{dialogId\}-tab-buy`}/);
  assert.match(component, /aria-labelledby={`\$\{dialogId\}-tab-stores`}/);
  assert.match(component, /aria-labelledby={`\$\{dialogId\}-tab-details`}/);
  assert.match(component, /onCancel=/);
  assert.match(component, /event\.key === (?:'Escape'|"Escape")/);
  assert.match(component, /useControlledDialog/);
  assert.match(component, /a\[href\], summary, input/);
  assert.match(component, /details:not\(\[open\]\)/);
  assert.match(
    component,
    /element\.tagName === "SUMMARY" && element\.parentElement === closedDetails/,
  );
  assert.equal(
    component.match(
      /hidden=\{tab !== (?:'buy'|"buy"|'stores'|"stores"|'details'|"details")\}/g,
    )?.length,
    3,
  );
  assert.match(
    panelStyles,
    /\.product-panel-body \[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
  );
});

test("the public wrapper keeps its two familiar triggers and delegates to the controlled sheet", () => {
  assert.match(
    component,
    /export function ProductQuickPanel\(data: ProductPanelData\)/,
  );
  assert.match(component, /> Find a store/);
  assert.match(component, /> Details/);
  assert.match(component, /<ProductQuickPanelSheet/);
  assert.match(component, /onClose=\{\(\) => setOpen\(false\)\}/);
});

test("mobile product actions float only after their in-flow region passes above the viewport", () => {
  assert.match(component, /className="product-quick-action-region"/);
  assert.match(component, /new IntersectionObserver/);
  assert.match(component, /entry\.boundingClientRect\.bottom <= viewportTop/);
  assert.match(
    component,
    /data-floating=\{actionsFloating \? "true" : "false"\}/,
  );
  assert.match(
    panelStyles,
    /\.product-quick-actions\[data-floating="true"\]\s*\{[\s\S]*?position:\s*fixed;/,
  );
  const inFlowActionBlock = panelStyles.match(
    /@media \(max-width: 620px\)[\s\S]*?\.product-quick-actions\s*\{([^}]+)\}/,
  )?.[1];
  assert.ok(inFlowActionBlock);
  assert.doesNotMatch(inFlowActionBlock, /position:\s*fixed/);
});

test("one server read model owns evidence and the public page consumes it", () => {
  assert.match(
    model,
    /export type ProductPanelTab = (?:'buy'|"buy") \| (?:'stores'|"stores") \| (?:'details'|"details")/,
  );
  assert.match(model, /export type ProductPanelData/);
  assert.match(
    model,
    /export async function readProductPanelData\(\s*product: Product,\s*now: number \| Date = Date\.now\(\),?\s*\)/,
  );
  assert.match(
    model,
    /if \(offer\.match === (?:'search'|"search")\) return \[\]/,
  );
  assert.match(model, /\(\[(?:'NG'|"NG"), (?:'US'|"US")\] as const\)/);
  assert.match(model, /getProductPriceTrends\(product\.slug, trendSnapshot\)/);
  assert.match(model, /listProductIngredientsSafe\(product\.slug\)/);
  assert.match(model, /getReviewedProductCare\(product\.slug\)/);
  assert.match(model, /buildProductCareDecision\(careReview, product\)/);
  assert.match(
    model,
    /href: `\/consult\?q=\$\{encodeURIComponent\(prompt\)\}`/,
  );
  assert.match(productPage, /readProductPanelData\(product\)/);
  assert.match(productPage, /<ProductQuickPanel \{\.\.\.panelData\} \/>/);
});

test("the details sheet turns every care state into one Ask Jelo next step", () => {
  assert.match(component, /data\.careDecision\.nextAction\.href/);
  assert.match(component, /data\.careDecision\.nextAction\.label/);
  assert.match(component, /className="product-panel-care-action"/);
  assert.match(component, /onClick=\{onClose\}/);
});

test("care review evidence is nested behind an accessible Details disclosure", () => {
  assert.match(component, /<details className="product-panel-evidence">/);
  assert.match(component, /<summary>[\s\S]*Review evidence[\s\S]*<\/summary>/);
  assert.match(component, /decision\.statusLabel/);
  assert.match(component, /<time dateTime=\{decision\.reviewedAt\}>/);
  assert.match(component, /aria-label="Care review sources"/);
  assert.match(component, /formatProductCareSourceLabel\(url\)/);
  assert.match(panelStyles, /\.product-panel-evidence > summary:focus-visible/);
  assert.doesNotMatch(productPage, /<ProductDecisionSummary/);
  assert.doesNotMatch(productPage, /careStatus=/);
});

test("public product routes reject slugs outside the checked-in publication set", () => {
  assert.match(productPage, /export const dynamicParams = false;/);
  assert.match(
    productPage,
    /return staticProducts\.map\(\(product\) => \(\{ slug: product\.slug \}\)\);/,
  );
});
