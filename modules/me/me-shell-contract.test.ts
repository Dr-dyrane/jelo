import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMeDockContext,
  ME_RELEASED_WORKSPACE_NAVIGATION,
  ME_WORKSPACE_FABS,
  ME_WORKSPACE_NAVIGATION,
  resolveMeHeaderHidden,
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
  assert.doesNotMatch(route, /ownerId|customerId|subject:/);
  assert.match(home, /href="\/me\/consult"/);
  assert.match(home, /`\/me\/product\/\$\{product\.slug\}`/);
  assert.match(home, /<BackLink href=\{backHref\}/);
  assert.match(home, /currentHref: route\.origin === 'home' \|\| route\.origin === 'consult'/);
  assert.match(home, /route\.origin === 'consult'[\s\S]*'\/me\/consult'/);
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
