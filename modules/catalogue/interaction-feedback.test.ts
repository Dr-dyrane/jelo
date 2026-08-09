import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

function ruleDeclarations(styles: string, selector: string): string {
  const match = styles.match(
    new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`),
  );
  assert.ok(match, `Missing ${selector} rule.`);
  return match[1];
}

function firstMediaBlock(styles: string, query: string): string {
  const start = styles.indexOf(query);
  assert.notEqual(start, -1, `Missing ${query} media query.`);
  const openingBrace = styles.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    if (styles[index] === "}") {
      depth -= 1;
      if (depth === 0) return styles.slice(openingBrace + 1, index);
    }
  }
  throw new Error(`Unclosed ${query} media query.`);
}

test("catalogue and concern filters acknowledge changes and stay reversible", async () => {
  const root = process.cwd();
  const catalogue = await readFile(
    path.join(root, "app/(site)/products/page.tsx"),
    "utf8",
  );
  const pageModel = await readFile(
    path.join(root, "lib/catalogue/catalogue-page-model.ts"),
    "utf8",
  );
  const feedback = await readFile(
    path.join(root, "components/products/filter-feedback-actions.tsx"),
    "utf8",
  );
  const tracker = await readFile(
    path.join(root, "components/products/catalogue-transition-tracker.tsx"),
    "utf8",
  );
  const sheet = await readFile(
    path.join(root, "components/products/inventory-filter-sheet.tsx"),
    "utf8",
  );
  const search = await readFile(
    path.join(root, "components/products/catalogue-search.tsx"),
    "utf8",
  );
  const searchStyles = await readFile(
    path.join(root, "components/products/catalogue-search.module.css"),
    "utf8",
  );
  const concerns = await readFile(
    path.join(root, "components/concerns/concern-selector.tsx"),
    "utf8",
  );
  const concernsPage = await readFile(
    path.join(root, "app/(site)/concerns/page.tsx"),
    "utf8",
  );
  const concernGuide = await readFile(
    path.join(root, "app/(site)/concerns/[slug]/page.tsx"),
    "utf8",
  );
  const productPanel = await readFile(
    path.join(root, "components/products/product-quick-panel.tsx"),
    "utf8",
  );
  const productPanelStyles = await readFile(
    path.join(root, "app/product-panel.css"),
    "utf8",
  );
  const navigation = await readFile(
    path.join(root, "components/navigation/site-header.tsx"),
    "utf8",
  );
  const layout = await readFile(
    path.join(root, "app/(site)/layout.tsx"),
    "utf8",
  );
  const navigationStyles = await readFile(
    path.join(root, "components/navigation/site-header.module.css"),
    "utf8",
  );
  const footerStyles = await readFile(path.join(root, "app/trust.css"), "utf8");
  const customerAccess = await readFile(
    path.join(root, "lib/customer/access.ts"),
    "utf8",
  );
  const signInIntent = await readFile(
    path.join(root, "lib/auth/sign-in-intent.ts"),
    "utf8",
  );
  const catalogueStyles = await readFile(
    path.join(root, "app/(site)/products/products.module.css"),
    "utf8",
  );
  const catalogueMotion = await readFile(
    path.join(root, "app/(site)/products/catalogue-feedback.module.css"),
    "utf8",
  );
  const concernMotion = await readFile(
    path.join(root, "components/concerns/concern-feedback.module.css"),
    "utf8",
  );

  assert.match(feedback, /role="status" aria-live="polite"/);
  assert.match(feedback, /catalogueTransitionMessage/);
  assert.match(feedback, /data-catalogue-transition-kind="undo"/);
  assert.match(tracker, /sessionStorage/);
  assert.match(catalogue, /CatalogueTransitionTracker/);
  assert.match(catalogue, /!model\.hasActiveIntent/);
  assert.match(pageModel, /resolvedCatalogueGuides/);
  assert.match(pageModel, /#all-products/);
  assert.match(catalogue, /CatalogueSearch/);
  assert.match(catalogue, /clearHref=\{model\.clearSearchHref\}/);
  assert.equal(
    (
      catalogue.match(
        /<DiscoveryRail[\s\S]*?href=\{href\(\s*params[\s\S]*?"all-products"[\s\S]*?\)\}/g,
      ) ?? []
    ).length,
    1,
  );
  assert.match(catalogue, /\["category", "routine", "concern"\]/);
  assert.match(catalogue, /result\.facets\.steps/);
  assert.match(catalogue, /marketHrefs=\{model\.marketHrefs\}/);
  assert.match(search, /role="combobox"/);
  assert.match(search, /aria-activedescendant/);
  assert.match(search, /role="listbox"/);
  assert.match(search, /role="status" aria-live="polite"/);
  assert.match(search, /recordCatalogueTransition/);
  assert.match(
    search,
    /defaultValue[\s\S]*recordCatalogueTransition\(clearHref\)[\s\S]*router\.push\(clearHref\)/,
  );
  assert.match(search, /href=\{marketHrefs\.NG\}/);
  assert.match(search, /href=\{marketHrefs\.US\}/);
  assert.match(ruleDeclarations(searchStyles, ".shell"), /position:\s*sticky;/);
  assert.match(ruleDeclarations(searchStyles, ".shell"), /top:\s*5\.35rem;/);
  const mobileSearchStyles = firstMediaBlock(
    searchStyles,
    "@media (max-width: 640px)",
  );
  assert.match(
    ruleDeclarations(mobileSearchStyles, ".suggestions"),
    /display:\s*none;/,
  );
  assert.match(
    ruleDeclarations(searchStyles, ".suggestionSheet"),
    /display:\s*none;/,
  );
  assert.match(
    mobileSearchStyles,
    /\.suggestionSheet\[open\]\s*\{[^}]*display:\s*block;/,
  );
  assert.match(
    ruleDeclarations(mobileSearchStyles, ".sheetBackdrop"),
    /position:\s*fixed;/,
  );
  assert.match(
    ruleDeclarations(mobileSearchStyles, ".sheetBackdrop"),
    /display:\s*block;/,
  );
  assert.doesNotMatch(search, /useControlledDialog/);
  assert.match(search, /open=\{isMobile && expanded\}/);
  assert.match(search, /showSuggestions && !isMobile/);
  assert.match(search, /suppressNextOpenRef/);
  assert.match(
    ruleDeclarations(mobileSearchStyles, ".shell"),
    /position:\s*sticky;/,
  );
  assert.match(ruleDeclarations(mobileSearchStyles, ".shell"), /top:\s*5rem;/);
  assert.match(searchStyles, /scrollbar-width: none/);
  assert.match(catalogueStyles, /^\.page\s*\{[\s\S]*overflow:\s*clip;/);
  assert.doesNotMatch(search, /[😀-🙏]/u);
  assert.equal((sheet.match(/<dialog/g) ?? []).length, 1);
  assert.doesNotMatch(sheet, /datalist|companyLogo|avatar/i);
  assert.match(sheet, /count > 0 \|\| filters\.category === value/);
  assert.match(sheet, /count > 0 \|\| filters\.review === value/);
  assert.match(sheet, /Boolean\(filters\.step\)/);
  assert.match(
    sheet,
    /facets\.steps\.filter\(\(\{ value, count \}\) => count > 0 \|\| filters\.step === value\)/,
  );
  assert.match(sheet, /name="step" value="" defaultChecked=\{!filters\.step\}/);
  assert.match(
    sheet,
    /name="step" value=\{value\} defaultChecked=\{filters\.step === value\}/,
  );
  assert.match(sheet, /Search brands/);
  assert.match(concerns, /role="status" aria-live="polite"/);
  assert.match(concerns, /Last change undone/);
  assert.match(concerns, /View matches/);
  assert.match(concerns, /Selections cleared/);
  assert.match(concerns, /!isProductMatchConcern\(concern\)/);
  assert.match(concerns, /guideCardLink/);
  assert.match(concernsPage, /filter\(isProductMatchConcern\)/);
  assert.match(concernGuide, /condition-pattern[\s\S]*Browse concerns/);
  assert.match(productPanel, /Find a store/);
  assert.match(productPanel, /How to use/);
  assert.doesNotMatch(productPanel, /Check the pack before use/);
  assert.doesNotMatch(productPanel, /Buy options|See prices/);
  assert.match(
    productPanelStyles,
    /\.product-panel-dialog\s*\{[\s\S]*inset: 0 0 0 auto;[\s\S]*box-sizing: border-box;/,
  );
  assert.match(
    productPanelStyles,
    /@media \(max-width: 620px\)[\s\S]*\.product-panel-dialog\s*\{[\s\S]*inset: auto 0 0;[\s\S]*max-width: 100vw;/,
  );
  assert.match(
    productPanelStyles,
    /@media \(max-width: 620px\)[\s\S]*\.product-panel-header h2\s*\{[\s\S]*overflow-wrap: anywhere;/,
  );
  assert.match(
    productPanelStyles,
    /@media \(max-width: 620px\)[\s\S]*\.product-panel-tabs\s*\{[\s\S]*overflow: hidden;/,
  );
  assert.match(navigation, /href="\/contribute"[^>]*>Contribute/);
  assert.match(
    navigation,
    /label: "Contribute",[\s\S]*?detail: "Tell us what you use"/,
  );
  assert.match(navigation, /href="\/share">Price watch/);
  assert.match(navigation, /href="\/brands">Brands/);
  assert.match(layout, /href="\/contribute">Contribute/);
  assert.equal((navigation.match(/href="\/me"/g) ?? []).length, 1);
  assert.match(
    navigation,
    /<Link className=\{styles\.memberLink\} href="\/me">[\s\S]*?Me[\s\S]*?<\/Link>/,
  );
  assert.match(
    navigation,
    /\{ href: "\/me", label: "Me", detail: "Your care workspace" \}/,
  );
  assert.doesNotMatch(navigation, /My JeloCare/);
  assert.equal((layout.match(/href="\/me"/g) ?? []).length, 1);
  assert.match(layout, /href="\/me">My JeloCare/);
  assert.match(
    ruleDeclarations(navigationStyles, ".links .memberLink"),
    /min-height:\s*2\.75rem;/,
  );
  assert.match(
    ruleDeclarations(navigationStyles, ".mobileLinks > a"),
    /min-height:\s*4\.4rem;/,
  );
  assert.match(
    ruleDeclarations(footerStyles, ".footer-group .footer-member-link"),
    /min-height:\s*2\.75rem;/,
  );
  assert.match(navigationStyles, /prefers-reduced-motion:\s*no-preference/);
  assert.match(navigationStyles, /prefers-reduced-transparency:\s*reduce/);
  assert.doesNotMatch(
    navigation,
    /requireCustomer|getSession|customerSignInPath|sign-in/,
  );
  assert.match(customerAccess, /redirect\(customerSignInPath\(\)\)/);
  assert.match(signInIntent, /return '\/sign-in\?next=\/me'/);
  assert.match(catalogueMotion, /prefers-reduced-motion/);
  assert.match(concernMotion, /prefers-reduced-motion/);
});
