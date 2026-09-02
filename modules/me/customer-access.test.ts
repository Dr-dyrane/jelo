import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { products } from "../../data/catalogue";
import {
  customerSignInPath,
  customerSignInRecoveryPath,
  resolveCustomerSignInRecovery,
  resolveSignInContinuation,
  resolveSignInIntent,
} from "../../lib/auth/sign-in-intent";
import {
  isDevelopmentCustomerFixtureEnabled,
  preferredCustomerFirstName,
  SYNTHETIC_CUSTOMER_ENV_FLAG,
} from "../../lib/customer/access-policy";
import {
  createSyntheticCustomerPortal,
  reviewedSyntheticSizeMatches,
} from "../../lib/customer/development-fixture";
import { LEGACY_SHELF_IMPORT_MANIFEST } from "../../lib/customer/legacy-shelf-import-manifest";
import { productRequestEntryHref } from "../../lib/customer/product-request-entry";

test("sign-in continuation accepts roots and exact bounded member Product destinations", () => {
  for (const continuation of [
    "/me",
    "/me/explore",
    "/me/shelf",
    "/me/shelf/add",
    "/me/routine",
    "/me/consult",
    "/me/orders",
    "/me/notifications",
    "/me/locations",
  ]) {
    const resolved = resolveSignInContinuation(continuation);
    assert.equal(resolved, continuation);
    assert.equal(resolveSignInIntent(resolved), "customer");
  }
  assert.equal(resolveSignInContinuation("/ops"), "/ops");
  for (const origin of ["home", "explore", "shelf", "routine"]) {
    const continuation = `/me/product/exact-product-${origin}?from=${origin}`;
    const resolved = resolveSignInContinuation(continuation);
    assert.equal(resolved, continuation);
    assert.equal(resolveSignInIntent(resolved), "customer");
  }
  const longestSlug = "a".repeat(180);
  assert.equal(
    resolveSignInContinuation(`/me/product/${longestSlug}?from=explore`),
    `/me/product/${longestSlug}?from=explore`,
  );
  assert.equal(
    resolveSignInContinuation(`/me/product/${"a".repeat(181)}?from=explore`),
    "/ops",
  );
  const shelfAddContinuation = productRequestEntryHref("Kuza black castor oil");
  assert.equal(
    resolveSignInContinuation(shelfAddContinuation),
    shelfAddContinuation,
  );
  assert.equal(resolveSignInIntent(shelfAddContinuation), "customer");

  for (const unsafe of [
    "/me/shelf/request/private-request-id",
    "/me/consult/private-thread",
    "/me/product/exact-product",
    "/me/product/exact-product/extra?from=explore",
    "/me/product/exact-product?from=unknown",
    "/me/product/exact-product?from=explore&next=/ops",
    "/me/product/exact-product?from=explore&extra=true",
    "/me/product/exact-product?from=explore%26next%3D%2Fops",
    "/me/product/..?from=explore",
    "/me/product/%2e%2e?from=explore",
    "/me/product/%252e%252e?from=explore",
    "/me/product/%2fops?from=explore",
    "/me/product/exact\\product?from=explore",
    "/me/shelf/add?request=Kuza%20black%20castor%20oil",
    "/me/shelf/add?from=market-finder&request=Kuza black castor oil",
    "/me/shelf/add?from=market-finder&request=Kuza%20black%20castor%20oil&next=/ops",
    "/me/shelf/add?from=market-finder&request=Kuza%0Ablack%20castor%20oil",
    "/me/shelf/add?from=market-finder&request=",
    "https://example.com/me/product/exact-product?from=explore",
    "//example.com/me/product/exact-product?from=explore",
    "javascript:alert(1)",
    "",
    null,
    undefined,
    ["/me/product/exact-product?from=explore"],
    ["/me/product/exact-product?from=explore", "/ops"],
  ]) {
    assert.equal(resolveSignInContinuation(unsafe), "/ops");
  }
  assert.equal(resolveSignInIntent("/me"), "customer");
  assert.equal(resolveSignInIntent("/ops"), "operator");
  assert.equal(customerSignInPath(), "/sign-in?next=/me");
  assert.equal(customerSignInPath("/ops"), "/sign-in?next=/me");
  assert.equal(
    customerSignInPath("/me/shelf/request/private-request-id"),
    "/sign-in?next=/me",
  );
  for (const continuation of [
    "/me/explore",
    "/me/shelf",
    "/me/shelf/add",
    "/me/routine",
    "/me/consult",
    "/me/orders",
    "/me/notifications",
    "/me/locations",
  ]) {
    assert.equal(
      customerSignInPath(continuation),
      `/sign-in?next=${encodeURIComponent(continuation)}`,
    );
  }
  assert.equal(
    customerSignInPath("/me/routine"),
    "/sign-in?next=%2Fme%2Froutine",
  );
  assert.equal(
    customerSignInPath("/me/product/exact-product?from=explore"),
    "/sign-in?next=%2Fme%2Fproduct%2Fexact-product%3Ffrom%3Dexplore",
  );
  assert.equal(
    customerSignInPath(shelfAddContinuation),
    `/sign-in?next=${encodeURIComponent(shelfAddContinuation)}`,
  );
  assert.equal(
    customerSignInRecoveryPath("/me/consult"),
    "/sign-in?next=%2Fme%2Fconsult&recovery=retry",
  );
  assert.equal(
    customerSignInRecoveryPath("/me/shelf/request/private-request-id"),
    "/sign-in?next=/me&recovery=retry",
  );
  assert.equal(resolveCustomerSignInRecovery("retry"), true);
  assert.equal(resolveCustomerSignInRecovery(["retry"]), false);
  assert.equal(resolveCustomerSignInRecovery(["retry", "retry"]), false);
});

test("signed-out released Me routes carry only canonical continuations through OTP", () => {
  const access = readFileSync("lib/customer/access.ts", "utf8");
  const productRoute = readFileSync(
    "app/(customer)/me/[...route]/page.ts",
    "utf8",
  );
  const signInPage = readFileSync("app/(auth)/sign-in/page.tsx", "utf8");

  assert.match(
    access,
    /requireCustomer\([\s\S]*continuation\?: string \| readonly string\[\] \| null/,
  );
  assert.match(access, /redirect\(customerSignInPath\(continuation\)\)/);
  assert.match(
    productRoute,
    /route\.kind === ['"]product['"][\s\S]*`\/me\/product\/\$\{route\.slug\}\?from=\$\{route\.origin\}`/,
  );
  assert.match(
    productRoute,
    /route\.kind === ['"]routine['"][\s\S]*\? ['"]\/me\/routine['"]/,
  );
  const continuationBlock = productRoute.slice(
    productRoute.indexOf("const continuation"),
    productRoute.indexOf("const customer"),
  );
  for (const continuation of [
    "/me/explore",
    "/me/shelf",
    "/me/shelf/add",
    "/me/routine",
    "/me/consult",
    "/me/orders",
    "/me/notifications",
    "/me/locations",
  ]) {
    assert.match(continuationBlock, new RegExp(`["']${continuation}["']`));
  }
  assert.match(
    continuationBlock,
    /route\.kind === ["']shelf-add["'][\s\S]*\? productRequestEntryHref\(productRequestInitialSearch\)/,
  );
  assert.doesNotMatch(continuationBlock, /shelf-request/);
  assert.match(productRoute, /requireCustomer\(continuation\)/);
  assert.doesNotMatch(
    productRoute,
    /addCustomerShelf|addCurrentBySlug|save_origin/,
  );
  assert.match(signInPage, /searchParams\.getAll\(["']next["']\)/);
  assert.match(signInPage, /requestedContinuations\.length === 1/);
  assert.match(signInPage, /searchParams\.getAll\(["']recovery["']\)/);
  assert.match(signInPage, /requestedRecoveries\.length === 1/);
  assert.match(signInPage, /window\.location\.assign\(continuation\)/);
});

test("the synthetic customer requires development plus the explicit local flag", () => {
  assert.equal(
    SYNTHETIC_CUSTOMER_ENV_FLAG,
    "JELOCARE_ENABLE_SYNTHETIC_CUSTOMER",
  );
  assert.equal(
    isDevelopmentCustomerFixtureEnabled({
      NODE_ENV: "development",
      JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: "true",
    }),
    true,
  );
  assert.equal(
    isDevelopmentCustomerFixtureEnabled({
      NODE_ENV: "production",
      JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: "true",
    }),
    false,
  );
  assert.equal(
    isDevelopmentCustomerFixtureEnabled({
      NODE_ENV: "development",
      JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: "false",
    }),
    false,
  );
  assert.equal(
    isDevelopmentCustomerFixtureEnabled({
      NODE_ENV: "test",
      JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: "true",
    }),
    false,
  );
});

test("the development presentation is server-only, synthetic, and local-data-only", () => {
  const fixture = readFileSync("lib/customer/development-fixture.ts", "utf8");
  const access = readFileSync("lib/customer/access.ts", "utf8");
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");

  assert.match(fixture, /import 'server-only'/);
  assert.match(fixture, /amara\.customer@example\.test/);
  assert.match(fixture, /Amara Example/);
  assert.match(fixture, /import \{ products \} from '@\/data\/catalogue'/);
  assert.doesNotMatch(
    fixture,
    /fetch\(|getPostgresClient|NEON_|sql`|https?:\/\//,
  );
  assert.match(access, /isDevelopmentCustomerFixtureEnabled\(process\.env\)/);
  assert.match(access, /const result = await getAuthSubjectResult\(\)/);
  assert.doesNotMatch(access, /searchParams|cookies\(\)|headers\(\)/);
  assert.doesNotMatch(home, /__qa|fixture|scenario selector|test customer/i);
});

test("the synthetic Shelf derives five approved products plus nine pending requests from legacy data", () => {
  const fixture = readFileSync("lib/customer/development-fixture.ts", "utf8");
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const homeView = readFileSync("components/me/home/home-view.tsx", "utf8");

  const acceptedSlugs = LEGACY_SHELF_IMPORT_MANIFEST.accepted.map(
    (binding) => binding.identityVersion.slugAtReview,
  );
  assert.equal(acceptedSlugs.length, 5);
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.length, 9);
  for (const slug of acceptedSlugs) {
    const product = products.find((candidate) => candidate.slug === slug);
    assert.ok(
      product?.image,
      `${slug} must remain an exact display-approved catalogue product`,
    );
    assert.doesNotMatch(
      fixture,
      new RegExp(slug),
      `${slug} must come from the manifest, not a copied list`,
    );
  }
  assert.match(fixture, /LEGACY_SHELF_IMPORT_MANIFEST\.accepted/);
  assert.doesNotMatch(fixture, /LEGACY_SHELF_IMPORT_MANIFEST\.rejected/);
  assert.match(fixture, /binding\.identityVersion\.slugAtReview/);
  assert.match(fixture, /saveOrigin: 'legacy_pages_v1_0'/);
  assert.match(
    fixture,
    /LEGACY_SHELF_IMPORT_MANIFEST\.requiredIdentity\.packageVersion/,
  );
  assert.match(fixture, /binding\.provenance\.routineReferences/);
  assert.match(fixture, /binding\.provenance\.usage/);
  assert.match(fixture, /\['done', 'confirmed', 'alert'\]/);
  assert.match(fixture, /concerns: \[\]/);
  assert.match(fixture, /selectedRetailers: \[\]/);
  assert.match(fixture, /synthetic: true/);
  assert.match(fixture, /routineProvenance: null/);
  assert.match(homeView, /routineSection\.provenance/);
  assert.match(home, /shelfState\.previewOnly/);
  assert.match(home, /Preview Shelf · Resets on reload\./);
  assert.doesNotMatch(fixture, /recommended|JeloCare routine/i);

  const portal = createSyntheticCustomerPortal();
  assert.equal(portal.shelf.length, 5);
  const ogx = portal.shelf.find(
    (item) => item.snapshot.slug === "ogx-renewing-argan-oil-of-morocco",
  );
  assert.equal(ogx?.snapshot.size, "100 ml");
  assert.equal(ogx?.product?.size, "3.3 fl oz");
  assert.equal(reviewedSyntheticSizeMatches("100 ml", "3.3 fl oz"), true);
  assert.equal(reviewedSyntheticSizeMatches("2 x 100 ml", "100 ml"), false);
  assert.equal(reviewedSyntheticSizeMatches("100 ml + 50 ml", "100 ml"), false);
  assert.equal(reviewedSyntheticSizeMatches("200 ml", "100 ml"), false);
});

test("preferred first names come only from a safe verified name token", () => {
  assert.equal(preferredCustomerFirstName("  Ọlá   Umeh  "), "Ọlá");
  assert.equal(preferredCustomerFirstName("Am\u202Eara Umeh"), "Amara");
  assert.equal(preferredCustomerFirstName("Ada@example.com"), null);
  assert.equal(preferredCustomerFirstName("https://example.com/Ada"), null);
  assert.equal(preferredCustomerFirstName("123 Ada"), null);
  assert.equal(preferredCustomerFirstName("A".repeat(80)), "A".repeat(32));
  assert.equal(preferredCustomerFirstName(null), null);
});

test("the real customer route owns account sign-out and no unreleased Concern link", () => {
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const accountSheet = readFileSync(
    "components/me/shell/me-account-sheet.tsx",
    "utf8",
  );
  const dock = readFileSync(
    "components/me/shell/me-workspace-dock.tsx",
    "utf8",
  );

  assert.match(home, /<MeAccountSheet/);
  assert.match(accountSheet, /authClient\.signOut\(\)/);
  assert.match(
    accountSheet,
    /window\.location\.assign\(['"]\/sign-in\?next=\/me['"]\)/,
  );
  assert.match(dock, /ME_RELEASED_WORKSPACE_NAVIGATION/);
  assert.doesNotMatch(home, /href=["'{`]\/me\/concerns/);
});

test("authentication failures are fail-closed without logging raw SDK errors", () => {
  const subject = readFileSync("lib/auth/subject.ts", "utf8");
  const access = readFileSync("lib/customer/access.ts", "utf8");

  assert.match(
    subject,
    /const \{ data: session, error \} = await getAuth\(\)\.getSession\(\)/,
  );
  assert.match(subject, /if \(error\)[\s\S]*status: ['"]unavailable['"]/);
  assert.match(
    subject,
    /if \(!user\?\.id\) return \{ status: ['"]signed-out['"] \}/,
  );
  assert.match(
    subject,
    /catch \{[\s\S]*Authentication session lookup unavailable\./,
  );
  assert.match(
    subject,
    /getAuthSubject\(\)[\s\S]*result\.status === ['"]authenticated['"] \? result\.identity : null/,
  );
  assert.doesNotMatch(subject, /console\.error\([^\n]*(?:err|error)[,)]/i);
  assert.match(
    access,
    /getCustomerIdentity\(\)[\s\S]*result\.status === ['"]authenticated['"] \? result\.identity : null/,
  );
  assert.match(
    access,
    /result\.status === ['"]unavailable['"][\s\S]*customerSignInRecoveryPath/,
  );
  assert.match(
    access,
    /if \(continuation === undefined\) redirect\(customerSignInPath\(\)\)/,
  );
});
