import assert from 'node:assert/strict';
import test from 'node:test';
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
} from '../../components/me/shell/me-shell-model';
import {
  INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
  resolveActiveWorkspaceNavigationItem,
  updateWorkspaceDockScrollState,
} from '../../lib/workspace-shell/dock-model';
import { readFileSync } from 'node:fs';

test('JeloCare Me has exactly four released primary destinations', () => {
  assert.deepEqual(ME_WORKSPACE_NAVIGATION.map(({ label, href }) => ({ label, href })), [
    { label: 'Home', href: '/me' },
    { label: 'Explore', href: '/me/explore' },
    { label: 'Shelf', href: '/me/shelf' },
    { label: 'Routine', href: '/me/routine' },
  ]);
  assert.deepEqual(ME_RELEASED_WORKSPACE_NAVIGATION, ME_WORKSPACE_NAVIGATION);
  assert.equal(resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, '/me/explore')?.id, 'explore');
  assert.equal(resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, '/me/shelf')?.id, 'shelf');
  assert.equal(resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, '/me/routine')?.id, 'routine');
});

test('stack Back is shell-owned, deterministic, and preserves the active parent', () => {
  for (const kind of ['home', 'explore', 'shelf', 'routine'] as const) {
    assert.equal(createMeStackBack({ kind }), undefined);
  }

  const cases = [
    { route: { kind: 'consult' } as const, href: '/me', label: 'Back to Home', parent: 'home' },
    { route: { kind: 'product', slug: 'exact', origin: 'home' } as const, href: '/me', label: 'Back to Home', parent: 'home' },
    { route: { kind: 'product', slug: 'exact', origin: 'explore' } as const, href: '/me/explore', label: 'Back to Explore', parent: 'explore' },
    { route: { kind: 'product', slug: 'exact', origin: 'shelf' } as const, href: '/me/shelf', label: 'Back to Shelf', parent: 'shelf' },
    { route: { kind: 'product', slug: 'exact', origin: 'routine' } as const, href: '/me/routine', label: 'Back to Routine', parent: 'routine' },
  ];
  for (const { route, href, label, parent } of cases) {
    assert.deepEqual(createMeStackBack(route), { href, accessibleLabel: label });
    assert.equal(resolveMeActiveParentHref(route), href);
    assert.equal(resolveActiveWorkspaceNavigationItem(ME_WORKSPACE_NAVIGATION, href)?.id, parent);
  }

  assert.equal(resolveMeProductOrigin('home'), 'home');
  assert.equal(resolveMeProductOrigin('explore'), 'explore');
  assert.equal(resolveMeProductOrigin('shelf'), 'shelf');
  assert.equal(resolveMeProductOrigin('routine'), 'routine');
  for (const unsafe of [undefined, 'consult', 'https://evil.example/me', '/me/explore', ['explore']]) {
    assert.equal(resolveMeProductOrigin(unsafe), 'home');
  }

  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const dock = readFileSync('components/workspace-shell/adaptive-workspace-dock.tsx', 'utf8');
  const dockStyles = readFileSync('components/workspace-shell/adaptive-workspace-dock.module.css', 'utf8');
  assert.doesNotMatch(home, /function BackLink|<BackLink|styles\.backLink|ArrowLeft/);
  assert.match(home, /const back = createMeStackBack\(route\)/);
  assert.match(home, /<MeWorkspaceDock[^>]*back=\{back\}/);
  assert.equal(dock.match(/<DockBack\b/g)?.length, 1);
  assert.match(dock, /data-workspace-dock-back=\{back\.href\}/);
  assert.match(dock, /aria-label=\{back\.accessibleLabel\}/);
  assert.match(dock, /mode === 'expanded'[\s\S]*\{backControl\}[\s\S]*\{navigation\(\)\}/);
  assert.match(dock, /mode === 'compact'[\s\S]*\{backControl \?\? \([\s\S]*<ActivePageOrb/);
  assert.match(dock, /mode === 'navigation'[\s\S]*\{backControl\}[\s\S]*\{navigation\(true\)\}/);
  assert.match(dockStyles, /\.pageOrb,[\s\S]*\.fab[\s\S]*width: 58px;[\s\S]*height: 58px;/);
  assert.match(dockStyles, /\.interactive:focus-visible/);
  assert.match(dockStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the complete portal surface vocabulary is concise, personal, and route-owned', () => {
  assert.deepEqual(ME_PORTAL_SURFACES, {
    home: { layer: 'primary', route: '/me', parent: 'home', eyebrow: 'JeloCare Me', title: 'My care.' },
    explore: { layer: 'primary', route: '/me/explore', parent: 'explore', eyebrow: 'Explore', title: 'My next product.' },
    shelf: { layer: 'primary', route: '/me/shelf', parent: 'shelf', eyebrow: 'Saved products', title: 'My Shelf.' },
    routine: { layer: 'primary', route: '/me/routine', parent: 'routine', eyebrow: 'My Routine', title: 'My Routine.' },
    consult: { layer: 'stack', route: '/me/consult', parent: 'home', eyebrow: 'Ask Me', title: 'My concern.' },
    product: { layer: 'stack', route: '/me/product/[slug]', parent: 'origin', eyebrow: null, title: null },
  });
  assert.equal(Object.keys(ME_PORTAL_SURFACES).length, 6);

  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const accountSheet = readFileSync('components/me/shell/me-account-sheet.tsx', 'utf8');
  for (const explanatoryCopy of [
    'Ask one question, keep what matters',
    'Browse JeloCare’s reviewed catalogue',
    'Only exact products you saved belong here',
    'A quiet view of the steps you arranged',
    'Search your care context and open',
  ]) {
    assert.doesNotMatch(home, new RegExp(explanatoryCopy));
  }
  assert.match(home, /ME_PORTAL_SURFACES\.home/);
  assert.match(home, /ME_PORTAL_SURFACES\.explore/);
  assert.match(home, /ME_PORTAL_SURFACES\.shelf/);
  assert.match(home, /ME_PORTAL_SURFACES\.routine/);
  assert.match(home, /ME_PORTAL_SURFACES\.consult/);
  assert.match(home, /On my Shelf/);
  assert.match(home, /In my Routine/);
  assert.match(accountSheet, />My Account</);
  assert.doesNotMatch(accountSheet, /Light or dark/);
});

test('standalone saved-product lists expand without widening mobile cards', () => {
  const styles = readFileSync('components/me/home/me-home.module.css', 'utf8');
  assert.match(styles, /\.productGrid \{ display: grid; min-width: 0; gap: 12px; \}/);
  assert.match(styles, /\.routineList \{[\s\S]*display: grid;[\s\S]*list-style: none;/);
  assert.match(
    styles,
    /@media \(min-width: 900px\) \{[\s\S]*\.listPage,[\s\S]*\.routePage > \.routineList[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.doesNotMatch(styles, /@media \(min-width: 900px\) \{[\s\S]*\.section > \.productGrid/);
});

test('Me context is descriptive and contains no mutation callback', () => {
  const context = createMeDockContext({ page: 'home', detail: 'Your care' });
  assert.deepEqual(context, {
    id: 'me-home',
    label: 'Home',
    detail: 'Your care',
    accessibleLabel: 'Home. Your care',
  });
  assert.equal('onClick' in context, false);
  assert.equal(createMeDockContext({ page: 'consult', detail: 'Your care context' }).label, 'Ask Me');
  assert.equal(createMeDockContext({ page: 'product', detail: 'Exact catalogue record' }).label, 'Product');
});

test('member routes are guarded, stack-owned, and never replace public product routes', () => {
  const route = readFileSync('app/(customer)/me/[...route]/page.ts', 'utf8');
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const publicProduct = readFileSync('app/(site)/products/[slug]/page.tsx', 'utf8');

  assert.match(route, /await requireCustomer\(\)/);
  assert.match(route, /section === 'explore'[\s\S]*section === 'shelf'[\s\S]*section === 'routine'[\s\S]*section === 'consult'/);
  assert.match(route, /parts\[0\] === 'product'/);
  assert.match(route, /resolveMeProductOrigin\(from\)/);
  assert.doesNotMatch(route, /PRODUCT_ORIGINS|:\s*'explore';/);
  assert.doesNotMatch(route, /ownerId|customerId|subject:/);
  assert.match(home, /href="\/me\/consult"/);
  assert.match(home, /`\/me\/product\/\$\{product\.slug\}`/);
  assert.doesNotMatch(home, /<BackLink|function BackLink/);
  assert.match(home, /currentHref: resolveMeActiveParentHref\(route\)/);
  assert.match(home, /createMeStackBack\(route\)/);
  assert.match(home, /source="home"/);
  assert.match(home, /window\.location\.assign\(`\/products\/\$\{route\.kind === 'product' \? route\.slug : ''\}`\)/);
  assert.doesNotMatch(home, /window\.location\.assign\('\/consult'/);
  assert.match(publicProduct, /findCatalogueProduct\(slug\)/);
  assert.match(publicProduct, /<main className="product-page">/);
});

test('every Me surface owns exactly one truthful working FAB', () => {
  assert.deepEqual(ME_WORKSPACE_FABS, {
    home: { ownerId: 'me-home-consult', label: 'Ask Me', action: 'navigate', href: '/me/consult' },
    explore: { ownerId: 'me-explore-search', label: 'Search products', action: 'focus-search' },
    shelf: { ownerId: 'me-shelf-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
    routine: { ownerId: 'me-routine-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
    consult: { ownerId: 'me-consult-search', label: 'Search your care', action: 'focus-search' },
    product: { ownerId: 'me-product-public-evidence', label: 'View public product evidence', action: 'public-product' },
  });
  assert.equal(Object.keys(ME_WORKSPACE_FABS).length, 6);

  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  assert.match(home, /const fabContract = ME_WORKSPACE_FABS\[state\.page\]/);
  assert.match(home, /useWorkspaceDockFabRegistration\(\{[\s\S]*ownerId: fabContract\.ownerId/);
  assert.match(home, /searchRef\.current\?\.focus/);
  assert.match(home, /window\.location\.assign\(fabContract\.href\)/);
  assert.match(home, /window\.location\.assign\(`\/products\/\$\{route\.kind === 'product' \? route\.slug : ''\}`\)/);
  assert.doesNotMatch(JSON.stringify(ME_WORKSPACE_FABS), /mutat|save|add|edit/i);
});

test('Me header visibility derives from the dock scroll state and route reset', () => {
  const down = updateWorkspaceDockScrollState(INITIAL_WORKSPACE_DOCK_SCROLL_STATE, 40);
  assert.equal(down.chromeHidden, true);
  assert.equal(resolveMeHeaderHidden({
    chromeHidden: down.chromeHidden,
    accountSheetOpen: false,
    headerOwnsFocus: false,
  }), true);
  assert.equal(resolveMeHeaderHidden({
    chromeHidden: down.chromeHidden,
    accountSheetOpen: true,
    headerOwnsFocus: false,
  }), false);
  assert.equal(resolveMeHeaderHidden({
    chromeHidden: down.chromeHidden,
    accountSheetOpen: false,
    headerOwnsFocus: true,
  }), false);

  const up = updateWorkspaceDockScrollState(down, 30);
  assert.equal(up.chromeHidden, false);
  assert.equal(updateWorkspaceDockScrollState(down, 0).chromeHidden, false);
  assert.equal(INITIAL_WORKSPACE_DOCK_SCROLL_STATE.chromeHidden, false);

  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const controller = readFileSync('components/workspace-shell/use-adaptive-workspace-dock-controller.ts', 'utf8');
  assert.equal(home.match(/\bonScroll=/g)?.length, 1);
  assert.match(home, /chromeHidden: controller\.scroll\.chromeHidden/);
  assert.match(home, /key=\{state\.routeKey\}[\s\S]*onScroll=.*controller\.onScrollPositionChange/);
  assert.match(controller, /state\.routeKey === routeKey[\s\S]*INITIAL_WORKSPACE_DOCK_SCROLL_STATE/);
});

test('account avatar owns one accessible extensible modal sheet', () => {
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const sheet = readFileSync('components/me/shell/me-account-sheet.tsx', 'utf8');
  const sheetStyles = readFileSync('components/me/shell/me-account-sheet.module.css', 'utf8');

  assert.doesNotMatch(home, /<details|<summary/);
  assert.match(home, /aria-haspopup="dialog"/);
  assert.match(home, /aria-controls="me-account-sheet"/);
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /aria-labelledby="me-account-sheet-title"/);
  assert.match(sheet, /dialog\.showModal\(\)/);
  assert.match(sheet, /onCancel=\{closeFromEscape\}/);
  assert.match(sheet, /onKeyDown=\{closeFromKeyDown\}/);
  assert.match(sheet, /event\.key !== 'Escape'/);
  assert.match(sheet, /event\.target === event\.currentTarget/);
  assert.match(sheet, /closeRef\.current\?\.focus/);
  assert.match(sheet, /const trigger = triggerRef\.current/);
  assert.match(sheet, /trigger\?\.focus/);
  assert.match(sheet, /body\.style\.overflow = 'hidden'/);
  assert.match(sheet, /ME_ACCOUNT_HELPER_ITEMS: readonly MeAccountHelperItem\[\] = \[\]/);
  assert.match(sheet, /<ThemeToggle \/>/);
  assert.match(sheet, /window\.location\.assign\('\/sign-in\?next=\/me'\)/);
  assert.doesNotMatch(sheet, /href:\s*['"]\/(privacy|help|settings)/i);
  assert.match(sheetStyles, /min-height: 48px/);
  assert.match(sheetStyles, /width: 44px/);
  assert.match(sheetStyles, /@media \(max-width: 620px\)/);
  assert.match(sheetStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(sheetStyles, /prefers-reduced-transparency: reduce/);
  assert.match(sheetStyles, /@media \(forced-colors: active\)/);
});
