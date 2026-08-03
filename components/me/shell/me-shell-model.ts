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
