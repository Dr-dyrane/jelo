import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMeDockContext,
  ME_RELEASED_WORKSPACE_NAVIGATION,
  ME_WORKSPACE_NAVIGATION,
} from '../../components/me/shell/me-shell-model';
import { resolveActiveWorkspaceNavigationItem } from '../../lib/workspace-shell/dock-model';
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
  assert.match(home, /window\.location\.assign\(`\/products\/\$\{product\.slug\}`\)/);
  assert.doesNotMatch(home, /window\.location\.assign\('\/consult'/);
  assert.match(publicProduct, /findCatalogueProduct\(slug\)/);
  assert.match(publicProduct, /<main className="product-page">/);
});

test('route-owned actions are functional and routine exposes no pretend mutation', () => {
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  assert.match(home, /ownerId: 'me-home-consult'/);
  assert.match(home, /ownerId: `me-\$\{route\.kind\}-search`/);
  assert.match(home, /searchRef\.current\?\.focus/);
  assert.match(home, /ownerId: 'me-shelf-explore'/);
  assert.match(home, /route\.kind === 'product' && product/);
  assert.doesNotMatch(home, /route\.kind === 'routine' \? \{/);
});
