import type { DockContextDescriptor, WorkspaceNavigationDescriptor } from '@/lib/workspace-shell/dock-model';

export const ME_WORKSPACE_NAVIGATION = [
  { id: 'home', label: 'Home', href: '/me' },
  { id: 'explore', label: 'Explore', href: '/me/explore' },
  { id: 'shelf', label: 'Shelf', href: '/me/shelf' },
  { id: 'routine', label: 'Routine', href: '/me/routine' },
] as const satisfies readonly WorkspaceNavigationDescriptor[];

export const ME_RELEASED_WORKSPACE_NAVIGATION = ME_WORKSPACE_NAVIGATION;

export type MeWorkspaceTab = typeof ME_WORKSPACE_NAVIGATION[number]['id'];
export type MeWorkspacePage = MeWorkspaceTab
  | 'orders'
  | 'consult'
  | 'product'
  | 'shelf-add'
  | 'shelf-request'
  | 'not-found';
export type MeProductOrigin = MeWorkspaceTab;
type MePrimaryRoute = {
  [Kind in MeWorkspaceTab]: { kind: Kind };
}[MeWorkspaceTab];
export type MePortalRoute =
  | MePrimaryRoute
  | { kind: 'orders' }
  | { kind: 'consult' }
  | { kind: 'not-found' }
  | { kind: 'shelf-add' }
  | { kind: 'shelf-request'; id: string }
  | { kind: 'product'; slug: string; origin: MeProductOrigin };

const ME_PRIMARY_HREFS: Record<MeWorkspaceTab, string> = {
  home: '/me',
  explore: '/me/explore',
  shelf: '/me/shelf',
  routine: '/me/routine',
};

export function resolveMeProductOrigin(from: unknown): MeProductOrigin {
  return typeof from === 'string' && Object.hasOwn(ME_PRIMARY_HREFS, from)
    ? from as MeProductOrigin
    : 'home';
}

export function resolveMeActiveParentHref(route: MePortalRoute): string {
  if (route.kind === 'consult') return ME_PRIMARY_HREFS.home;
  if (route.kind === 'orders') return ME_PRIMARY_HREFS.home;
  if (route.kind === 'not-found') return ME_PRIMARY_HREFS.explore;
  if (route.kind === 'shelf-add' || route.kind === 'shelf-request') return ME_PRIMARY_HREFS.shelf;
  if (route.kind === 'product') return ME_PRIMARY_HREFS[route.origin];
  return ME_PRIMARY_HREFS[route.kind];
}

export function createMeStackBack(route: MePortalRoute) {
  if (
    route.kind !== 'consult'
    && route.kind !== 'orders'
    && route.kind !== 'product'
    && route.kind !== 'shelf-add'
    && route.kind !== 'shelf-request'
    && route.kind !== 'not-found'
  ) return undefined;
  const href = resolveMeActiveParentHref(route);
  const parent = ME_WORKSPACE_NAVIGATION.find((item) => item.href === href)
    ?? ME_WORKSPACE_NAVIGATION[0];
  return {
    href,
    accessibleLabel: `Back to ${parent.label}`,
  };
}

export const ME_PORTAL_SURFACES = {
  home: { layer: 'primary', route: '/me', parent: 'home', eyebrow: null, title: 'Home' },
  explore: { layer: 'primary', route: '/me/explore', parent: 'explore', eyebrow: 'Explore', title: 'My next product.' },
  shelf: { layer: 'primary', route: '/me/shelf', parent: 'shelf', eyebrow: 'My products', title: 'My Shelf.' },
  routine: { layer: 'primary', route: '/me/routine', parent: 'routine', eyebrow: 'My Routine', title: 'My Routine.' },
  orders: { layer: 'stack', route: '/me/orders', parent: 'home', eyebrow: 'My orders', title: 'Track every request.' },
  consult: { layer: 'stack', route: '/me/consult', parent: 'home', eyebrow: 'Ask Me', title: 'My concern.' },
  product: { layer: 'stack', route: '/me/product/[slug]', parent: 'origin', eyebrow: null, title: null },
  'shelf-add': { layer: 'stack', route: '/me/shelf/add', parent: 'shelf', eyebrow: 'My Shelf', title: 'Find it first.' },
  'shelf-request': { layer: 'stack', route: '/me/shelf/request/[id]', parent: 'shelf', eyebrow: 'Private request', title: null },
  'not-found': { layer: 'stack', route: '/me/product/[slug]', parent: 'explore', eyebrow: 'JeloCare Me', title: 'Nothing here.' },
} as const satisfies Record<MeWorkspacePage, {
  layer: 'primary' | 'stack';
  route: string;
  parent: MeWorkspaceTab | 'origin';
  eyebrow: string | null;
  title: string | null;
}>;

export const ME_WORKSPACE_FABS = {
  home: { ownerId: 'me-home-consult', label: 'Ask Me', action: 'navigate', href: '/me/consult' },
  explore: { ownerId: 'me-explore-search', label: 'Search products', action: 'focus-search' },
  shelf: { ownerId: 'me-shelf-add', label: 'Add to your Shelf', action: 'navigate', href: '/me/shelf/add' },
  routine: { ownerId: 'me-routine-add', label: 'Create routine', action: 'open-routine-builder' },
  orders: { ownerId: 'me-orders-shop', label: 'Start a basket', action: 'navigate', href: '/products' },
  consult: { ownerId: 'me-consult-search', label: 'Search your care', action: 'focus-search' },
  product: { ownerId: 'me-product-find-store', label: 'Find a store', action: 'open-product-prices' },
  'shelf-add': { ownerId: 'me-shelf-add-search', label: 'Search exact catalogue', action: 'focus-search' },
  'shelf-request': { ownerId: 'me-shelf-request-another', label: 'Request another product', action: 'navigate', href: '/me/shelf/add' },
  'not-found': { ownerId: 'me-not-found-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
} as const satisfies Record<MeWorkspacePage, {
  ownerId: string;
  label: string;
  action: 'navigate' | 'focus-search' | 'open-product-prices' | 'open-routine-builder';
  href?: string;
}>;

const STACK_PAGE_LABELS = {
  orders: 'Orders',
  consult: 'Ask Me',
  product: 'Product',
  'shelf-add': 'Add product',
  'shelf-request': 'Private request',
  'not-found': 'Not found',
} as const;

export function createMeDockContext({
  page,
  detail,
}: {
  page: MeWorkspacePage;
  detail: string;
}): DockContextDescriptor {
  const label = ME_WORKSPACE_NAVIGATION.find((item) => item.id === page)?.label
    ?? STACK_PAGE_LABELS[page as keyof typeof STACK_PAGE_LABELS];
  if (!label) throw new Error(`Unknown JeloCare Me page: ${page}`);
  return {
    id: `me-${page}`,
    label,
    detail,
    accessibleLabel: `${label}. ${detail}`,
  };
}

export function resolveMeHeaderHidden({
  chromeHidden,
  accountSheetOpen,
  headerOwnsFocus,
}: {
  chromeHidden: boolean;
  accountSheetOpen: boolean;
  headerOwnsFocus: boolean;
}) {
  return chromeHidden && !accountSheetOpen && !headerOwnsFocus;
}
