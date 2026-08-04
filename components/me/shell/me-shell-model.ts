import type { DockContextDescriptor, WorkspaceNavigationDescriptor } from '@/lib/workspace-shell/dock-model';

export const ME_WORKSPACE_NAVIGATION = [
  { id: 'home', label: 'Home', href: '/me' },
  { id: 'explore', label: 'Explore', href: '/me/explore' },
  { id: 'shelf', label: 'Shelf', href: '/me/shelf' },
  { id: 'routine', label: 'Routine', href: '/me/routine' },
] as const satisfies readonly WorkspaceNavigationDescriptor[];

export const ME_RELEASED_WORKSPACE_NAVIGATION = ME_WORKSPACE_NAVIGATION;

export type MeWorkspaceTab = typeof ME_WORKSPACE_NAVIGATION[number]['id'];
export type MeWorkspacePage = MeWorkspaceTab | 'consult' | 'product' | 'not-found';
export type MeProductOrigin = MeWorkspaceTab;
type MePrimaryRoute = {
  [Kind in MeWorkspaceTab]: { kind: Kind };
}[MeWorkspaceTab];
export type MePortalRoute =
  | MePrimaryRoute
  | { kind: 'consult' }
  | { kind: 'not-found' }
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
  if (route.kind === 'not-found') return ME_PRIMARY_HREFS.explore;
  if (route.kind === 'product') return ME_PRIMARY_HREFS[route.origin];
  return ME_PRIMARY_HREFS[route.kind];
}

export function createMeStackBack(route: MePortalRoute) {
  if (route.kind !== 'consult' && route.kind !== 'product' && route.kind !== 'not-found') return undefined;
  const href = resolveMeActiveParentHref(route);
  const parent = ME_WORKSPACE_NAVIGATION.find((item) => item.href === href)
    ?? ME_WORKSPACE_NAVIGATION[0];
  return {
    href,
    accessibleLabel: `Back to ${parent.label}`,
  };
}

export const ME_PORTAL_SURFACES = {
  home: { layer: 'primary', route: '/me', parent: 'home', eyebrow: 'JeloCare Me', title: 'My care.' },
  explore: { layer: 'primary', route: '/me/explore', parent: 'explore', eyebrow: 'Explore', title: 'My next product.' },
  shelf: { layer: 'primary', route: '/me/shelf', parent: 'shelf', eyebrow: 'My products', title: 'My Shelf.' },
  routine: { layer: 'primary', route: '/me/routine', parent: 'routine', eyebrow: 'My Routine', title: 'My Routine.' },
  consult: { layer: 'stack', route: '/me/consult', parent: 'home', eyebrow: 'Ask Me', title: 'My concern.' },
  product: { layer: 'stack', route: '/me/product/[slug]', parent: 'origin', eyebrow: null, title: null },
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
  shelf: { ownerId: 'me-shelf-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
  routine: { ownerId: 'me-routine-add', label: 'Add routine step', action: 'navigate', href: '/me/explore' },
  consult: { ownerId: 'me-consult-search', label: 'Search your care', action: 'focus-search' },
  product: { ownerId: 'me-product-public-evidence', label: 'View product', action: 'public-product' },
  'not-found': { ownerId: 'me-not-found-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
} as const satisfies Record<MeWorkspacePage, {
  ownerId: string;
  label: string;
  action: 'navigate' | 'focus-search' | 'public-product';
  href?: string;
}>;

const STACK_PAGE_LABELS = {
  consult: 'Ask Me',
  product: 'Product',
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
