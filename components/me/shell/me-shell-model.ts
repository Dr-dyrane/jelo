import type { DockContextDescriptor, WorkspaceNavigationDescriptor } from '@/lib/workspace-shell/dock-model';

export const ME_WORKSPACE_NAVIGATION = [
  { id: 'home', label: 'Home', href: '/me' },
  { id: 'explore', label: 'Explore', href: '/me/explore' },
  { id: 'shelf', label: 'Shelf', href: '/me/shelf' },
  { id: 'routine', label: 'Routine', href: '/me/routine' },
] as const satisfies readonly WorkspaceNavigationDescriptor[];

export const ME_RELEASED_WORKSPACE_NAVIGATION = ME_WORKSPACE_NAVIGATION;

export type MeWorkspaceTab = typeof ME_WORKSPACE_NAVIGATION[number]['id'];
export type MeWorkspacePage = MeWorkspaceTab | 'consult' | 'product';

export const ME_WORKSPACE_FABS = {
  home: { ownerId: 'me-home-consult', label: 'Ask Me', action: 'navigate', href: '/me/consult' },
  explore: { ownerId: 'me-explore-search', label: 'Search products', action: 'focus-search' },
  shelf: { ownerId: 'me-shelf-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
  routine: { ownerId: 'me-routine-explore', label: 'Explore products', action: 'navigate', href: '/me/explore' },
  consult: { ownerId: 'me-consult-search', label: 'Search your care', action: 'focus-search' },
  product: { ownerId: 'me-product-public-evidence', label: 'View public product evidence', action: 'public-product' },
} as const satisfies Record<MeWorkspacePage, {
  ownerId: string;
  label: string;
  action: 'navigate' | 'focus-search' | 'public-product';
  href?: string;
}>;

const STACK_PAGE_LABELS = {
  consult: 'Ask Me',
  product: 'Product',
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
