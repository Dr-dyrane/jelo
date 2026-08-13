import assert from "node:assert/strict";
import test from "node:test";
import {
  createMeStackBack,
  createMeDockContext,
  ME_PORTAL_SURFACES,
  ME_RELEASED_WORKSPACE_NAVIGATION,
  ME_WORKSPACE_FABS,
  ME_WORKSPACE_NAVIGATION,
  resolveMeActiveParentHref,
  resolveMeHeaderHidden,
  resolveMeProductOrigin,
} from "../../components/me/shell/me-shell-model";
import { createMeContextSheetModel } from "../../components/me/shell/me-context-model";
import {
  INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
  resolveActiveWorkspaceNavigationItem,
  updateWorkspaceDockScrollState,
} from "../../lib/workspace-shell/dock-model";
import { readFileSync } from "node:fs";

test("JeloCare Me has exactly four released primary destinations", () => {
  assert.deepEqual(
    ME_WORKSPACE_NAVIGATION.map(({ label, href }) => ({ label, href })),
    [
      { label: "Home", href: "/me" },
      { label: "Explore", href: "/me/explore" },
      { label: "Shelf", href: "/me/shelf" },
      { label: "Routine", href: "/me/routine" },
    ],
  );
  assert.deepEqual(ME_RELEASED_WORKSPACE_NAVIGATION, ME_WORKSPACE_NAVIGATION);
  assert.equal(
    resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, "/me/explore")
      ?.id,
    "explore",
  );
  assert.equal(
    resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, "/me/shelf")
      ?.id,
    "shelf",
  );
  assert.equal(
    resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, "/me/routine")
      ?.id,
    "routine",
  );
});

test("stack Back is shell-owned, deterministic, and preserves the active parent", () => {
  for (const kind of ["home", "explore", "shelf", "routine"] as const) {
    assert.equal(createMeStackBack({ kind }), undefined);
  }

  const cases = [
    {
      route: { kind: "consult" } as const,
      href: "/me",
      label: "Back to Home",
      parent: "home",
    },
    {
      route: { kind: "product", slug: "exact", origin: "home" } as const,
      href: "/me",
      label: "Back to Home",
      parent: "home",
    },
    {
      route: { kind: "product", slug: "exact", origin: "explore" } as const,
      href: "/me/explore",
      label: "Back to Explore",
      parent: "explore",
    },
    {
      route: { kind: "product", slug: "exact", origin: "shelf" } as const,
      href: "/me/shelf",
      label: "Back to Shelf",
      parent: "shelf",
    },
    {
      route: { kind: "product", slug: "exact", origin: "routine" } as const,
      href: "/me/routine",
      label: "Back to Routine",
      parent: "routine",
    },
    {
      route: { kind: "shelf-add" } as const,
      href: "/me/shelf",
      label: "Back to Shelf",
      parent: "shelf",
    },
    {
      route: { kind: "shelf-request", id: "request-id" } as const,
      href: "/me/shelf",
      label: "Back to Shelf",
      parent: "shelf",
    },
  ];
  for (const { route, href, label, parent } of cases) {
    assert.deepEqual(createMeStackBack(route), {
      href,
      accessibleLabel: label,
    });
    assert.equal(resolveMeActiveParentHref(route), href);
    assert.equal(
      resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, href)?.id,
      parent,
    );
  }

  assert.equal(resolveMeProductOrigin("home"), "home");
  assert.equal(resolveMeProductOrigin("explore"), "explore");
  assert.equal(resolveMeProductOrigin("shelf"), "shelf");
  assert.equal(resolveMeProductOrigin("routine"), "routine");
  for (const unsafe of [
    undefined,
    "consult",
    "https://evil.example/me",
    "/me/explore",
    ["explore"],
  ]) {
    assert.equal(resolveMeProductOrigin(unsafe), "home");
  }

  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const dock = readFileSync(
    "components/workspace-shell/adaptive-workspace-dock.tsx",
    "utf8",
  );
  const dockStyles = readFileSync(
    "components/workspace-shell/adaptive-workspace-dock.module.css",
    "utf8",
  );
  assert.doesNotMatch(
    home,
    /function BackLink|<BackLink|styles\.backLink|ArrowLeft/,
  );
  assert.match(home, /const back = createMeStackBack\(route\)/);
  assert.match(home, /<MeWorkspaceDock[^>]*back=\{back\}/);
  assert.equal(dock.match(/<DockBack\b/g)?.length, 1);
  assert.match(dock, /data-workspace-dock-back=\{back\.href\}/);
  assert.match(dock, /aria-label=\{back\.accessibleLabel\}/);
  assert.match(
    dock,
    /mode === ['"]expanded['"][\s\S]*\{backControl\}[\s\S]*\{navigation\(\)\}/,
  );
  assert.match(
    dock,
    /mode === ['"]compact['"][\s\S]*\{backControl \?\? \([\s\S]*<ActivePageOrb/,
  );
  assert.match(
    dock,
    /mode === ['"]navigation['"][\s\S]*\{backControl\}[\s\S]*\{navigation\(true\)\}/,
  );
  assert.match(
    dockStyles,
    /\.pageOrb,[\s\S]*\.fab[\s\S]*width: 58px;[\s\S]*height: 58px;/,
  );
  assert.match(dockStyles, /\.interactive:focus-visible/);
  assert.match(dockStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("the complete portal surface vocabulary is concise, personal, and route-owned", () => {
  assert.deepEqual(ME_PORTAL_SURFACES, {
    home: {
      layer: "primary",
      route: "/me",
      parent: "home",
      eyebrow: null,
      title: "Home",
    },
    explore: {
      layer: "primary",
      route: "/me/explore",
      parent: "explore",
      eyebrow: "Explore",
      title: "My next product.",
    },
    shelf: {
      layer: "primary",
      route: "/me/shelf",
      parent: "shelf",
      eyebrow: "My products",
      title: "My Shelf.",
    },
    routine: {
      layer: "primary",
      route: "/me/routine",
      parent: "routine",
      eyebrow: "My Routine",
      title: "My Routine.",
    },
    orders: {
      layer: "stack",
      route: "/me/orders",
      parent: "home",
      eyebrow: "My orders",
      title: "Track every request.",
    },
    notifications: {
      layer: "stack",
      route: "/me/notifications",
      parent: "home",
      eyebrow: "Order notifications",
      title: "Nothing important gets lost.",
    },
    locations: {
      layer: "stack",
      route: "/me/locations",
      parent: "home",
      eyebrow: "Private account data",
      title: "My locations.",
    },
    consult: {
      layer: "stack",
      route: "/me/consult",
      parent: "home",
      eyebrow: "Ask Me",
      title: "My concern.",
    },
    product: {
      layer: "stack",
      route: "/me/product/[slug]",
      parent: "origin",
      eyebrow: null,
      title: null,
    },
    "shelf-add": {
      layer: "stack",
      route: "/me/shelf/add",
      parent: "shelf",
      eyebrow: "My Shelf",
      title: "Find it first.",
    },
    "shelf-request": {
      layer: "stack",
      route: "/me/shelf/request/[id]",
      parent: "shelf",
      eyebrow: "Private request",
      title: null,
    },
    "not-found": {
      layer: "stack",
      route: "/me/product/[slug]",
      parent: "explore",
      eyebrow: "JeloCare Me",
      title: "Nothing here.",
    },
  });
  assert.equal(Object.keys(ME_PORTAL_SURFACES).length, 12);

  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const homeView = readFileSync("components/me/home/home-view.tsx", "utf8");
  const exploreView = readFileSync(
    "components/me/explore/explore-view.tsx",
    "utf8",
  );
  const routineView = readFileSync(
    "components/me/routine/routine-view.tsx",
    "utf8",
  );
  const consultView = readFileSync(
    "components/me/consult/consult-view.tsx",
    "utf8",
  );
  const productView = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  const accountSheet = readFileSync(
    "components/me/shell/me-account-sheet.tsx",
    "utf8",
  );
  for (const explanatoryCopy of [
    "Ask one question, keep what matters",
    "Browse JeloCare’s reviewed catalogue",
    "Only exact products you saved belong here",
    "A quiet view of the steps you arranged",
    "Search your care context and open",
  ]) {
    assert.doesNotMatch(home, new RegExp(explanatoryCopy));
  }
  assert.match(homeView, /ME_PORTAL_SURFACES\.home/);
  assert.match(exploreView, /ME_PORTAL_SURFACES\.explore/);
  assert.match(home, /ME_PORTAL_SURFACES\.shelf/);
  assert.match(routineView, /ME_PORTAL_SURFACES\.routine/);
  assert.match(consultView, /ME_PORTAL_SURFACES\.consult/);
  assert.match(productView, /shelfContextLabel/);
  assert.match(productView, /routineContext/);
  assert.match(accountSheet, />My Account</);
  assert.doesNotMatch(accountSheet, /Light or dark/);
});

test("standalone saved-product lists expand without widening mobile cards", () => {
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const dock = readFileSync(
    "components/me/shell/me-workspace-dock.tsx",
    "utf8",
  );
  assert.match(home, /className="product-grid"/);
  assert.match(dock, /ShelvingUnit/);
  assert.match(dock, /ClockFading as RotateCwFadingClock/);
  assert.doesNotMatch(dock, /LibraryBig/);
  assert.match(home, /<ShelvingUnit size=\{24\}/);
  assert.doesNotMatch(home, /LibraryBig/);
});

test("Me context stays truthful and expands into useful route shortcuts", () => {
  const context = createMeDockContext({ page: "home", detail: "Your care" });
  assert.deepEqual(context, {
    id: "me-home",
    label: "Home",
    detail: "Your care",
    accessibleLabel: "Home. Your care",
  });
  assert.equal("onClick" in context, false);
  assert.equal(
    createMeDockContext({ page: "consult", detail: "Your care context" }).label,
    "Ask Me",
  );
  assert.equal(
    createMeDockContext({ page: "product", detail: "Exact catalogue record" })
      .label,
    "Product",
  );

  const product = {
    slug: "exact-product",
    brand: "Exact Brand",
    name: "Exact Serum",
    size: "30 ml",
    category: "Face",
    step: "Treat",
    image: "/exact.png",
    displayLine: "Exact line",
    usage: "Use as directed.",
    priceLabel: null,
    supportedConcernSlugs: ["dry-dehydrated-skin"],
    freshExactRetailerNames: [],
  };
  const shelfItem = {
    identityVersionId: "11111111-1111-4111-8111-111111111111",
    savedAt: "2026-08-03T12:00:00.000Z",
    saveOrigin: "synthetic-development" as const,
    lifecycleState: "active" as const,
    availability: "available" as const,
    snapshot: {
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      size: product.size,
      versionNumber: 1,
      packageVersion: "synthetic-development",
      formulaVersion: "synthetic-development",
    },
    product,
    message: null,
  };
  const viewModel = {
    account: {
      displayName: "Amara Example",
      preferredFirstName: "Amara",
      email: "amara.customer@example.test",
      synthetic: true,
    },
    featuredProduct: product,
    concerns: [
      {
        slug: "dry-dehydrated-skin",
        name: "Dry & dehydrated skin",
        area: "Face" as const,
        kind: "concern" as const,
        source: "synthetic-development" as const,
      },
    ],
    selectedRetailers: [],
    shelfState: { status: "ready" as const, message: null },
    shelf: [shelfItem],
    routineProvenance: "Amara’s routine",
    routine: [
      {
        id: "treat",
        moment: "Saved step",
        status: "confirmed" as const,
        product,
      },
    ],
  };
  const shelf = createMeContextSheetModel({
    route: { kind: "shelf" },
    viewModel,
    visibleProductCount: 1,
    product: undefined,
  });
  assert.equal(shelf.title, "My Shelf");
  assert.equal(shelf.summary, "1 saved product");
  assert.deepEqual(shelf.items[0], {
    id: shelfItem.identityVersionId,
    label: "Exact Serum",
    detail: "Exact Brand · 30 ml",
    href: "/me/product/exact-product?from=shelf",
  });
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "home" },
      viewModel,
      visibleProductCount: 1,
      product: undefined,
    }).summary,
    "1 saved product · 1 step · 1 concern",
  );
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "explore" },
      viewModel,
      visibleProductCount: 1,
      product: undefined,
    }).title,
    "My Explore",
  );
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "routine" },
      viewModel,
      visibleProductCount: 1,
      product: undefined,
    }).items[0]?.href,
    "/me/product/exact-product?from=routine",
  );
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "consult" },
      viewModel,
      visibleProductCount: 1,
      product: undefined,
    }).summary,
    "1 saved concern · Session-only guide",
  );
  const memberProduct = createMeContextSheetModel({
    route: { kind: "product", slug: product.slug, origin: "shelf" },
    viewModel,
    visibleProductCount: 1,
    product,
  });
  assert.equal(memberProduct.summary, "On my Shelf · In my Routine");
  assert.deepEqual(
    memberProduct.items.map(({ label, href }) => ({ label, href })),
    [
      { label: "My Shelf", href: "/me/shelf" },
      { label: "My Routine", href: "/me/routine" },
    ],
  );

  const unavailableViewModel = {
    ...viewModel,
    shelfState: {
      status: "unavailable" as const,
      message: "Shelf is unavailable right now.",
    },
    shelf: [],
  };
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "home" },
      viewModel: unavailableViewModel,
      visibleProductCount: 1,
    }).summary,
    "Shelf unavailable · 1 step · 1 concern",
  );
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "shelf" },
      viewModel: unavailableViewModel,
      visibleProductCount: 1,
    }).summary,
    "Shelf unavailable",
  );
  assert.equal(
    createMeContextSheetModel({
      route: { kind: "product", slug: product.slug, origin: "explore" },
      viewModel: unavailableViewModel,
      visibleProductCount: 1,
      product,
    }).summary,
    "Shelf unavailable · In my Routine",
  );

  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const contextModel = readFileSync(
    "components/me/shell/me-context-model.ts",
    "utf8",
  );
  const capsule = readFileSync(
    "components/workspace-shell/dock-context.tsx",
    "utf8",
  );
  const sheet = readFileSync(
    "components/me/shell/me-context-sheet.tsx",
    "utf8",
  );
  const modalHook = readFileSync("components/ui/use-modal-dialog.ts", "utf8");
  assert.match(capsule, /data-workspace-dock-context-action/);
  assert.match(
    capsule,
    /aria-expanded=\{context\.controls \? context\.expanded : undefined\}/,
  );
  assert.match(capsule, /aria-controls=\{context\.controls\}/);
  assert.match(home, /controls: ["']me-context-sheet["']/);
  assert.match(home, /onInvoke: [\s\S]*setContextSheetState/);
  assert.match(home, /controls: ["']me-product-evidence-sheet["']/);
  assert.match(home, /onInvoke: \(\) => openProductPanel\(['\"]details['\"]\)/);
  assert.match(
    home,
    /accountSheetOpen: accountSheetOpen \|\| contextSheetOpen \|\| productPanelOpen/,
  );
  assert.doesNotMatch(contextModel, /\/products\//);
  assert.match(sheet, /role="dialog"/);
  assert.match(modalHook, /element\.showModal\(\)/);
  assert.match(modalHook, /scrollOwner\.style\.overflow = ['"]hidden['"]/);
  assert.match(modalHook, /trigger\?\.isConnected\) trigger\.focus/);
  assert.match(sheet, /onCancel=\{handleCancel\}/);
});

test("member routes are guarded, stack-owned, and never replace public product routes", () => {
  const route = readFileSync("app/(customer)/me/[...route]/page.ts", "utf8");
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const homeView = readFileSync("components/me/home/home-view.tsx", "utf8");
  const productView = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  const publicProduct = readFileSync(
    "app/(site)/products/[slug]/page.tsx",
    "utf8",
  );
  const sharedPanel = readFileSync(
    "components/products/product-quick-panel.tsx",
    "utf8",
  );

  assert.match(
    route,
    /route\.kind === ["']product["'][\s\S]*`\/me\/product\/\$\{route\.slug\}\?from=\$\{route\.origin\}`/,
  );
  assert.match(route, /await requireCustomer\(continuation\)/);
  assert.match(
    route,
    /route\.kind === ['"]explore['"][\s\S]*readMeExplore\(customer\)/,
  );
  assert.match(
    route,
    /section === ['"]explore['"][\s\S]*section === ['"]shelf['"][\s\S]*section === ['"]routine['"][\s\S]*section === ['"]consult['"]/,
  );
  assert.match(route, /parts\[0\] === ['"]product['"]/);
  assert.match(route, /resolveMeProductOrigin\(from\)/);
  assert.doesNotMatch(route, /PRODUCT_ORIGINS|:\s*['"]explore['"];/);
  assert.doesNotMatch(route, /ownerId|customerId|subject:/);
  assert.match(homeView, /askEntry\.href/);
  const sharedViews = readFileSync(
    "components/me/home/shared-views.tsx",
    "utf8",
  );
  assert.match(sharedViews, /`\/me\/product\/\$\{product\.slug\}`/);
  assert.doesNotMatch(home, /<BackLink|function BackLink/);
  assert.match(home, /currentHref: resolveMeActiveParentHref\(route\)/);
  assert.match(home, /createMeStackBack\(route\)/);
  assert.match(homeView, /memberProductHref\(.*['"]home['"]\)/);
  assert.match(
    route,
    /if \(route\.kind === ['"]product['"]\) \{[\s\S]*findCatalogueProduct\(route\.slug\)[\s\S]*readProductPanelData\(selectedProduct, now\)/,
  );
  assert.equal(route.match(/readProductPanelData\(/g)?.length, 1);
  assert.equal(home.match(/<ProductQuickPanelSheet/g)?.length, 1);
  assert.match(
    home,
    /<ProductQuickPanelSheet[\s\S]*data=\{productPanelData\}[\s\S]*open=\{productPanelOpen\}[\s\S]*tab=\{productPanelState\.tab\}/,
  );
  assert.match(
    home,
    /document\.activeElement[\s\S]*productPanelRestoreFocusRef\.current/,
  );
  assert.match(home, /restoreFocusRef=\{productPanelRestoreFocusRef\}/);
  assert.match(
    productView,
    /onClick=\{\(event\) => onOpenPanel\(['"]buy['"], event\.currentTarget\)\}/,
  );
  assert.match(
    productView,
    /onClick=\{\(event\) => onOpenPanel\(['"]details['"], event\.currentTarget\)\}/,
  );
  assert.doesNotMatch(
    home,
    /View product|public-product|href=\{`\/products\/|window\.location\.assign\(`\/products/,
  );
  assert.doesNotMatch(home, /window\.location\.assign\(['"]\/consult['"]/);
  assert.match(publicProduct, /findCatalogueProduct\(slug\)/);
  assert.match(publicProduct, /<main className="product-page">/);
  assert.match(sharedPanel, /\{ id: "buy", label: "Prices" \}/);
  assert.match(sharedPanel, /\{ id: "stores", label: "Search" \}/);
  assert.match(sharedPanel, /\{ id: "details", label: "Details" \}/);
  assert.match(sharedPanel, /href=\{`\/go\?product=/);
});

test("Explore is route-scoped and keeps private discovery state inside the Me layout", () => {
  const layout = readFileSync("app/(customer)/me/layout.tsx", "utf8");
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const state = readFileSync(
    "components/me/explore/me-explore-state.tsx",
    "utf8",
  );
  const explore = readFileSync(
    "components/me/explore/explore-view.tsx",
    "utf8",
  );
  const css = readFileSync("components/me/home/me-home.module.css", "utf8");

  assert.match(layout, /<MeExploreStateProvider>/);
  assert.match(home, /shellViewModelFromExplore/);
  assert.match(home, /setExploreScrollPosition\(scrollTop\)/);
  assert.match(home, /scrollTo\(\{ top: getExploreScrollPosition\(\) \}\)/);
  assert.doesNotMatch(
    state,
    /localStorage|sessionStorage|URLSearchParams|document\.cookie/,
  );
  assert.match(explore, /aria-label="Product categories"/);
  assert.match(explore, /aria-label="Active filters"/);
  assert.match(explore, />Request a missing product</);
  assert.match(explore, />In your routine</);
  assert.match(css, /\.exploreSearchRow[\s\S]*position: sticky/);
});

test("Routine is route-scoped, visual once, and edits through its builder", () => {
  const route = readFileSync("app/(customer)/me/[...route]/page.ts", "utf8");
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const view = readFileSync("components/me/routine/routine-view.tsx", "utf8");
  const manager = readFileSync(
    "components/me/routine/routine-manager.tsx",
    "utf8",
  );
  const sheet = readFileSync("components/me/routine/routine-sheet.tsx", "utf8");

  assert.match(
    route,
    /route\.kind === ["']routine["'][\s\S]*readMeRoutine\(customer\)/,
  );
  assert.match(home, /shellViewModelFromRoutine/);
  assert.match(view, /<RoutineManager/);
  assert.doesNotMatch(view, /RoutineRail|routineGrid|routineRailCard/);
  assert.match(manager, /<SafeProductImage/);
  assert.match(manager, />Product no longer available</);
  assert.match(manager, />Pending review</);
  assert.match(sheet, /name="revision" value=\{routine\.revision\}/);
  assert.match(sheet, /moveStep\(index, -1\)/);
  assert.match(sheet, /<RoutineDeleteDialog routine=\{routine\}/);
  assert.match(
    home,
    /window\.dispatchEvent\(new Event\(OPEN_ROUTINE_BUILDER_EVENT\)\)/,
  );
});

test("Ask Me is route-scoped and reuses one reviewed guidance authority with opt-in context", () => {
  const route = readFileSync("app/(customer)/me/[...route]/page.ts", "utf8");
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const view = readFileSync("components/me/consult/consult-view.tsx", "utf8");
  const experience = readFileSync(
    "components/consult/consult-experience.tsx",
    "utf8",
  );
  const api = readFileSync("app/api/consult/route.ts", "utf8");
  const capabilities = readFileSync(
    "lib/customer/customer-capabilities.ts",
    "utf8",
  );

  assert.match(
    route,
    /route\.kind === ['"]consult['"][\s\S]*readMeConsult\(customer\)/,
  );
  assert.match(home, /shellViewModelFromConsult/);
  assert.match(home, /consultComposerRef/);
  assert.match(view, /<ConsultExperience/);
  assert.match(view, /memberContext=\{memberContext\}/);
  assert.doesNotMatch(view, /fetch\(|assessClinicalRoutine|\/api\/consult/);
  assert.match(
    experience,
    /useState\(\{ concerns: false, products: false \}\)/,
  );
  assert.match(
    experience,
    /Nothing from My JeloCare is included unless you choose it\./,
  );
  assert.match(experience, /Session only/);
  assert.match(experience, /memberContext: selectedMemberContext/);
  assert.match(api, /reviewedConcernSlugs\.has\(slug\)/);
  assert.match(api, /catalogueBySlug\.get\(slug\)\?\.verifiedIngredientIds/);
  assert.match(capabilities, /authenticatedGuidance: true/);
  assert.match(capabilities, /assistedProcurement: true/);
});

test("Saved Product is removable from any origin, not just Shelf", () => {
  const productView = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  const button = readFileSync(
    "components/me/shelf/shelf-action-button.tsx",
    "utf8",
  );
  assert.match(productView, /className=\{styles\.productActions\}/);
  assert.match(productView, /<ShoppingBag size=\{16\}[\s\S]*Find a store/);
  assert.match(productView, /<Info size=\{16\}[\s\S]*Details/);
  // The shelf item is always passed — removal works from Home, Explore, Routine, or Shelf.
  assert.match(productView, /shelfItem=\{shelfItem\}/);
  // saved is always false — the button is never a disabled "Saved" state.
  assert.match(productView, /saved=\{false\}/);
  // The mutation handler is always wired — announcements work from every origin.
  assert.match(productView, /onSettled=\{onShelfMutation\}/);
  assert.doesNotMatch(productView, /Public product evidence/);
  assert.match(button, /Remove from Shelf/);
});

test("every Me surface owns exactly one truthful working FAB", () => {
  assert.deepEqual(ME_WORKSPACE_FABS, {
    home: {
      ownerId: "me-home-consult",
      label: "Ask Me",
      action: "navigate",
      href: "/me/consult",
    },
    explore: {
      ownerId: "me-explore-search",
      label: "Search products",
      action: "focus-search",
    },
    shelf: {
      ownerId: "me-shelf-add",
      label: "Add to your Shelf",
      action: "navigate",
      href: "/me/shelf/add",
    },
    routine: {
      ownerId: "me-routine-add",
      label: "Create routine",
      action: "open-routine-builder",
    },
    orders: {
      ownerId: "me-orders-shop",
      label: "Start a basket",
      action: "navigate",
      href: "/products",
    },
    notifications: {
      ownerId: "me-notifications-orders",
      label: "View my orders",
      action: "navigate",
      href: "/me/orders",
    },
    locations: {
      ownerId: "me-locations-shop",
      label: "Start a basket",
      action: "navigate",
      href: "/products",
    },
    consult: {
      ownerId: "me-consult-search",
      label: "Search your care",
      action: "focus-search",
    },
    product: {
      ownerId: "me-product-find-store",
      label: "Find a store",
      action: "open-product-prices",
    },
    "shelf-add": {
      ownerId: "me-shelf-add-search",
      label: "Search exact catalogue",
      action: "focus-search",
    },
    "shelf-request": {
      ownerId: "me-shelf-request-another",
      label: "Request another product",
      action: "navigate",
      href: "/me/shelf/add",
    },
    "not-found": {
      ownerId: "me-not-found-explore",
      label: "Explore products",
      action: "navigate",
      href: "/me/explore",
    },
  });
  assert.equal(Object.keys(ME_WORKSPACE_FABS).length, 12);

  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const dockNavigation = readFileSync(
    "components/workspace-shell/dock-navigation.tsx",
    "utf8",
  );
  assert.match(home, /const fabContract = ME_WORKSPACE_FABS\[state\.page\]/);
  assert.match(
    home,
    /useWorkspaceDockFabRegistration\(\{[\s\S]*ownerId: fabContract\.ownerId/,
  );
  assert.match(
    home,
    /route\.kind === ["']consult["'] \? consultComposerRef\.current : searchRef\.current/,
  );
  assert.match(home, /target\?\.focus/);
  assert.match(home, /router\.push\(fabContract\.href\)/);
  assert.doesNotMatch(home, /window\.location\.assign\(fabContract\.href\)/);
  assert.match(
    home,
    /fabContract\.action === ["']open-product-prices["'][\s\S]*openProductPanel\(["']buy["']\)/,
  );
  assert.doesNotMatch(home, /window\.location\.assign\(`\/products/);
  assert.match(dockNavigation, /import Link from ['"]next\/link['"]/);
  assert.match(dockNavigation, /<Link[\s\S]*href=\{item\.href\}/);
  assert.doesNotMatch(dockNavigation, /<a[\s\S]*href=\{item\.href\}/);
  assert.equal(ME_WORKSPACE_FABS.routine.label, "Create routine");
  assert.doesNotMatch(JSON.stringify(ME_WORKSPACE_FABS), /mutat|save|edit/i);
});

test("Me header visibility derives from the dock scroll state and route reset", () => {
  const down = updateWorkspaceDockScrollState(
    INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
    40,
  );
  assert.equal(down.chromeHidden, true);
  assert.equal(
    resolveMeHeaderHidden({
      chromeHidden: down.chromeHidden,
      accountSheetOpen: false,
      headerOwnsFocus: false,
    }),
    true,
  );
  assert.equal(
    resolveMeHeaderHidden({
      chromeHidden: down.chromeHidden,
      accountSheetOpen: true,
      headerOwnsFocus: false,
    }),
    false,
  );
  assert.equal(
    resolveMeHeaderHidden({
      chromeHidden: down.chromeHidden,
      accountSheetOpen: false,
      headerOwnsFocus: true,
    }),
    false,
  );

  const up = updateWorkspaceDockScrollState(down, 30);
  assert.equal(up.chromeHidden, false);
  assert.equal(updateWorkspaceDockScrollState(down, 0).chromeHidden, false);
  assert.equal(INITIAL_WORKSPACE_DOCK_SCROLL_STATE.chromeHidden, false);

  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const controller = readFileSync(
    "components/workspace-shell/use-adaptive-workspace-dock-controller.ts",
    "utf8",
  );
  assert.equal(home.match(/\bonScroll=/g)?.length, 1);
  assert.match(home, /chromeHidden: controller\.scroll\.chromeHidden/);
  assert.match(
    home,
    /key=\{state\.routeKey\}[\s\S]*onScroll=\{\(event\) => \{[\s\S]*controller\.onScrollPositionChange/,
  );
  assert.match(
    controller,
    /state\.routeKey === routeKey[\s\S]*INITIAL_WORKSPACE_DOCK_SCROLL_STATE/,
  );
});

test("Me paints through the top viewport inset while keeping its controls safe", () => {
  const layout = readFileSync("app/(customer)/me/layout.tsx", "utf8");
  const styles = readFileSync("components/me/home/me-home.module.css", "utf8");

  assert.match(
    layout,
    /export const viewport: Viewport = \{\s*viewportFit: 'cover',?\s*\};/,
  );
  assert.match(styles, /\.shell \{[^}]*position: fixed;[^}]*inset: 0;/);
  assert.match(
    styles,
    /\.topbar \{[^}]*padding: max\(14px, env\(safe-area-inset-top\)\)/,
  );
  assert.match(styles, /\.content \{[^}]*env\(safe-area-inset-bottom\)/);
});

test("HomeView wires the shelf rail through the CSS module, not a global class", () => {
  const homeView = readFileSync("components/me/home/home-view.tsx", "utf8");
  assert.match(
    homeView,
    /className=\{`product-rail \$\{styles\.feedShelfRail\}`\}/,
  );
  assert.doesNotMatch(homeView, /className="product-rail feedShelfRail"/);
});

test("the ultra-narrow section-heading rule exists and stacks headings vertically", () => {
  const styles = readFileSync("components/me/home/me-home.module.css", "utf8");
  assert.match(
    styles,
    /@media \(max-width: 240px\)[^{]*\{[^}]*\.feedSectionHeading \{[^}]*flex-direction: column/,
  );
});

test("the compact reading pill does not become an ellipsised fragment", () => {
  const dockStyles = readFileSync(
    "components/workspace-shell/adaptive-workspace-dock.module.css",
    "utf8",
  );
  const dockContext = readFileSync(
    "components/workspace-shell/dock-context.tsx",
    "utf8",
  );
  const dockModel = readFileSync("lib/workspace-shell/dock-model.ts", "utf8");
  const meHome = readFileSync("components/me/home/me-home.tsx", "utf8");

  // The DockContextDescriptor type supports a compactDetail field.
  assert.match(dockModel, /compactDetail\?:/);
  // The capsule renders the compact detail as a separate span.
  assert.match(dockContext, /contextDetailCompact/);
  // The CSS swaps full detail for compact detail at ultra-narrow width.
  assert.match(dockStyles, /\.contextDetailCompact/);
  assert.match(
    dockStyles,
    /@media \(max-width: 240px\)[\s\S]*\.contextDetail \{ display: none/,
  );
  assert.match(
    dockStyles,
    /@media \(max-width: 240px\)[\s\S]*\.contextDetailCompact \{ display: block/,
  );
  // Home sets compactDetail to a useful short reading, not a truncated fragment.
  assert.match(
    meHome,
    /compactDetail:[\s\S]*route\.kind === ['"]home['"] \? `\$\{shelfCount\} saved` : undefined/,
  );
  // The full accessible label retains both counts.
  assert.match(
    meHome,
    /Home summary\. \$\{shelfCount\} saved products and \$\{routineStepCount\} routine steps/,
  );
});

test("account avatar owns one accessible extensible modal sheet", () => {
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const sheet = readFileSync(
    "components/me/shell/me-account-sheet.tsx",
    "utf8",
  );
  const sheetStyles = readFileSync(
    "components/me/shell/me-account-sheet.module.css",
    "utf8",
  );
  const modalHook = readFileSync("components/ui/use-modal-dialog.ts", "utf8");

  assert.doesNotMatch(home, /<details|<summary/);
  assert.match(home, /aria-haspopup="dialog"/);
  assert.match(home, /aria-controls="me-account-sheet"/);
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /aria-labelledby="me-account-sheet-title"/);
  assert.match(modalHook, /element\.showModal\(\)/);
  assert.match(sheet, /onCancel=\{handleCancel\}/);
  assert.match(sheet, /initialFocusRef: closeRef/);
  assert.match(modalHook, /trigger\?\.isConnected\) trigger\.focus/);
  assert.match(modalHook, /scrollOwner\.style\.overflow = 'hidden'/);
  assert.match(
    sheet,
    /ME_ACCOUNT_HELPER_ITEMS: readonly MeAccountHelperItem\[\] = \[[\s\S]*Report price or availability[\s\S]*href: ["']\/contribute["']/,
  );
  assert.match(sheet, /My orders[\s\S]*href: ['"]\/me\/orders['"]/);
  assert.match(sheet, /Saved locations[\s\S]*href: ['"]\/me\/locations['"]/);
  assert.doesNotMatch(sheet, /\/contribute\?/);
  assert.match(sheet, /href="\/me\/shelf\/export"/);
  assert.match(
    sheet,
    /shelfAvailable \? \([\s\S]*href="\/me\/shelf\/export"[\s\S]*<button type="button" disabled>/,
  );
  assert.match(sheet, /Clear Shelf/);
  assert.match(sheet, /<ThemeToggle \/>/);
  assert.match(
    sheet,
    /window\.location\.assign\(['"]\/sign-in\?next=\/me['"]\)/,
  );
  assert.doesNotMatch(sheet, /href:\s*[['"]"]\/(privacy|help|settings)/i);
  assert.match(sheetStyles, /min-height: 48px/);
  assert.match(sheetStyles, /width: 44px/);
  assert.match(sheetStyles, /@media \(max-width: 620px\)/);
  assert.match(sheetStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(sheetStyles, /prefers-reduced-transparency: reduce/);
  assert.match(sheetStyles, /@media \(forced-colors: active\)/);
});

test("Member Product renders a truthful market reading with price, stores, and freshness", () => {
  const marketReading = readFileSync(
    "modules/commerce/market-reading.ts",
    "utf8",
  );
  const productView = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  const styles = readFileSync("components/me/home/me-home.module.css", "utf8");

  // The commerce module owns the market-reading builder with a discriminated union.
  assert.match(marketReading, /export type MarketReading =/);
  assert.match(marketReading, /state: "priced"/);
  assert.match(marketReading, /state: "listing-only"/);
  assert.match(marketReading, /state: "unavailable"/);
  assert.match(marketReading, /priceLabel: string;/);
  assert.match(marketReading, /storeCount: number/);
  assert.match(marketReading, /basis: "single-source" \| "multi-source"/);
  assert.match(marketReading, /observedAt: string/);
  assert.match(marketReading, /freshnessLabel: string/);
  assert.match(marketReading, /export function buildMarketReading/);
  assert.match(marketReading, /export function freshnessLabelFor/);
  assert.match(marketReading, /export function formatMarketPrice/);

  // The view renders the server-owned reading — no client-side date math.
  assert.match(productView, /marketReading/);
  assert.match(productView, /marketPrice/);
  assert.match(productView, /marketStores/);
  assert.match(productView, /marketFreshness/);
  assert.match(productView, /observed store/);
  assert.match(productView, /<time/);
  assert.doesNotMatch(productView, /formatFreshness/);
  assert.doesNotMatch(productView, /new Date\(\)/);
  // The view uses explicit shelf context and routine context.
  assert.match(productView, /shelfContextLabel/);
  assert.match(productView, /routineContext/);

  // The CSS styles the market reading section.
  assert.match(styles, /\.marketReading \{/);
  assert.match(styles, /\.marketPrice \{/);
  assert.match(styles, /\.marketStores \{/);
  assert.match(styles, /\.marketFreshness \{/);
});

test("unavailable Shelf states fail closed while synthetic state stays explicitly preview-only", () => {
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const productView = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  const button = readFileSync(
    "components/me/shelf/shelf-action-button.tsx",
    "utf8",
  );
  const account = readFileSync(
    "components/me/shell/me-account-sheet.tsx",
    "utf8",
  );
  const previewState = readFileSync(
    "components/me/shelf/me-shelf-state.tsx",
    "utf8",
  );

  assert.match(home, /viewModel\.shelfState\.status === ["']ready["'] \? \(/);
  assert.match(productView, /shelfAvailable/);
  assert.match(home, /["']Shelf unavailable["']/);
  assert.match(home, /Preview Shelf · Resets on reload\./);
  assert.match(button, /onAction[\s\S]*\? await onAction\(mutation\)/);
  assert.match(previewState, /scope: 'preview-only'/);
  assert.match(previewState, /resetsOnReload: true/);
  assert.doesNotMatch(
    previewState,
    /localStorage|sessionStorage|document\.cookie/,
  );
  assert.match(account, /Preview only · resets on reload/);
  assert.match(account, /jelocare-preview-shelf\.json/);
  assert.match(
    account,
    /shelfAvailable \? \([\s\S]*Export Shelf[\s\S]*<button type="button" disabled>/,
  );
});

test("Shelf removals announce and restore focus at a durable page-level target", () => {
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  const sharedViews = readFileSync(
    "components/me/home/shared-views.tsx",
    "utf8",
  );
  const button = readFileSync(
    "components/me/shelf/shelf-action-button.tsx",
    "utf8",
  );
  assert.match(button, /onSettled\?\.\(result\)/);
  assert.match(
    sharedViews,
    /function UnavailableShelfCard\([\s\S]*shelfItem=\{item\}/,
  );
  assert.match(sharedViews, /onSettled=\{onSettled\}/);
  assert.match(home, /shelfMutationStatusRef/);
  assert.match(home, /tabIndex=\{-1\}/);
  assert.match(home, /aria-atomic="true"/);
  assert.match(
    home,
    /shelfMutationStatusRef\.current\?\.focus\(\{ preventScroll: true \}\)/,
  );
  assert.match(
    home,
    /result\.status === ['"]removed['"] \|\| result\.status === ['"]already_removed['"]/,
  );
});

test("Me loading and error states keep recognizable route, dock, and FAB identity", () => {
  const state = readFileSync("components/me/shell/me-route-state.tsx", "utf8");
  const loading = readFileSync("app/(customer)/me/loading.tsx", "utf8");
  const error = readFileSync("app/(customer)/me/error.tsx", "utf8");
  assert.match(state, /className=\{styles\.topbar\}/);
  assert.match(state, /ME_WORKSPACE_NAVIGATION\.map/);
  assert.match(state, /className=\{styles\.stateDock\}/);
  assert.match(state, /className=\{styles\.stateFab\}/);
  assert.match(state, /href="\/me\/consult"/);
  assert.match(state, />Home</);
  assert.match(loading, /<MeRouteState state="loading"/);
  assert.match(error, /<MeRouteState state="error" onRetry=\{reset\}/);
});

test("Product route passes the resolved product to readMeProduct, not a slug", () => {
  // Source contract: the route calls readMeProduct with the resolved product,
  // not a slug. readMeProduct does NOT call the catalogue lookup internally.
  const page = readFileSync("app/(customer)/me/[...route]/page.ts", "utf8");
  assert.match(page, /readMeProduct\(customer, selectedProduct/);
  // readMeProduct accepts a Product, not a string slug.
  const readModels = readFileSync("lib/customer/route-read-models.ts", "utf8");
  assert.match(
    readModels,
    /readMeProduct\(identity: CustomerAccessIdentity, product: Product/,
  );
  // readMeProduct does NOT import the catalogue lookup.
  assert.doesNotMatch(readModels, /import\s+\{[^}]*findCatalogueProduct/);
  // The function body does NOT call the catalogue lookup.
  const fnBody = readModels.slice(
    readModels.indexOf("export async function readMeProduct"),
    readModels.indexOf(
      "export async function",
      readModels.indexOf("export async function readMeProduct") + 1,
    ),
  );
  assert.doesNotMatch(fnBody, /findCatalogueProduct\(/);
});

test("Product read model includes a real shell summary with global Shelf count", () => {
  const readModels = readFileSync("lib/customer/route-read-models.ts", "utf8");
  // The CustomerProductReadModel includes a ProductShellSummary with shelfCount.
  assert.match(readModels, /export type ProductShellSummary =/);
  assert.match(readModels, /shelfCount: number/);
  assert.match(readModels, /routineStepCount: number/);
  assert.match(readModels, /routineAvailable: boolean/);
  // The read model uses it.
  assert.match(readModels, /shell: ProductShellSummary/);
  // The shell adapter does not fake the shelf as a single-item array.
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  assert.doesNotMatch(home, /shelfItem \? \[shelfItem\] : \[\]/);
});

test("MeAccountSheet accepts a shelf count independently from the item array", () => {
  const account = readFileSync(
    "components/me/shell/me-account-sheet.tsx",
    "utf8",
  );
  assert.match(account, /shelfCount\?: number/);
  assert.match(account, /resolvedShelfCount/);
  // The product page passes the live count for synthetic preview, and the
  // server count for production. Both must be present in the wiring.
  const home = readFileSync("components/me/home/me-home.tsx", "utf8");
  assert.match(home, /shelfCount=\{[\s\S]*shelfState\.previewOnly/);
  assert.match(home, /productReadModel\?\.shell\.shelfCount/);
});

test("Product Shelf context uses explicit states, not slug detection alone", () => {
  const ctx = readFileSync("lib/customer/product-shelf-context.ts", "utf8");
  assert.match(ctx, /state: 'saved-current'/);
  assert.match(ctx, /state: 'saved-changed'/);
  assert.match(ctx, /state: 'not-saved'/);
  assert.match(ctx, /state: 'unavailable'/);
  // Matches by both product slug and snapshot slug (for changed identities).
  assert.match(ctx, /item\.product\?\.slug === productSlug/);
  assert.match(ctx, /item\.snapshot\.slug === productSlug/);
});

test("Routine context includes ready and unavailable authority states", () => {
  const ctx = readFileSync("lib/customer/routine-context.ts", "utf8");
  assert.match(ctx, /state: 'ready'/);
  assert.match(ctx, /state: 'unavailable'/);
  assert.match(ctx, /unavailableRoutineContext/);
  assert.match(ctx, /Routine unavailable/);
  // The read model uses unavailableRoutineContext when the routine service fails.
  const readModels = readFileSync("lib/customer/route-read-models.ts", "utf8");
  assert.match(readModels, /unavailableRoutineContext\(\)/);
});

test("Market reading is a discriminated union without redundant nullable fields", () => {
  const market = readFileSync("modules/commerce/market-reading.ts", "utf8");
  // No redundant unavailable boolean.
  assert.doesNotMatch(market, /unavailable: boolean/);
  // No impossible nullable combinations on priced state.
  assert.match(market, /state: "priced";[\s\S]*?priceLabel: string;/);
  assert.match(market, /state: "priced";[\s\S]*?observedAt: string;/);
  assert.match(market, /state: "priced";[\s\S]*?freshnessLabel: string;/);
  // Listing-only has listingCount, not storeCount.
  assert.match(market, /state: "listing-only";[\s\S]*?listingCount: number/);
  // Unavailable has no extra fields.
  assert.match(market, /state: "unavailable";\s*\}/);
  // Market-aware formatter.
  assert.match(market, /export function formatMarketPrice/);
});

test("Market price label derives from the same buildMarketReading foundation", () => {
  const label = readFileSync("modules/commerce/market-price-label.ts", "utf8");
  assert.match(label, /buildMarketReading/);
  // Does not independently call summarizeMarket.
  assert.doesNotMatch(label, /summarizeMarket/);
});

test("Member Product view renders freshness with a time element", () => {
  const view = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  assert.match(view, /<time dateTime=\{reading\.observedAt\}>/);
  // Listing-only uses "observed listing" language.
  assert.match(view, /observed listing/);
});

test("Personal context is inline text, not filled badges", () => {
  const view = readFileSync(
    "components/me/product/member-product-view.tsx",
    "utf8",
  );
  const css = readFileSync("components/me/home/me-home.module.css", "utf8");
  // The view uses a paragraph element for personal context.
  assert.match(view, /productPersonalLine/);
  // The CSS does not use badge/pill styling for personal context.
  assert.match(css, /\.productPersonalLine \{/);
  assert.doesNotMatch(css, /\.productPersonalContext \{/);
});

test("deriveRoutineSteps helper has been removed", () => {
  const readModels = readFileSync("lib/customer/route-read-models.ts", "utf8");
  assert.doesNotMatch(readModels, /function deriveRoutineSteps/);
});

test("routine deletion submits identity without overloading the server-action button", () => {
  const dialog = readFileSync(
    "components/me/routine/routine-delete-dialog.tsx",
    "utf8",
  );
  assert.match(
    dialog,
    /<input type="hidden" name="routineId" value=\{routine\.id\} \/>/,
  );
  assert.doesNotMatch(
    dialog,
    /formAction=\{deleteRoutineAction\}[\s\S]{0,120}name="routineId"/,
  );
});
