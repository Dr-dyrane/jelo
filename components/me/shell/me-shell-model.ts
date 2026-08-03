import type { DockContextDescriptor, WorkspaceNavigationDescriptor } from '@/lib/workspace-shell/dock-model';

export const ME_WORKSPACE_NAVIGATION = [
  { id: 'ask', label: 'Ask', href: '/me' },
  { id: 'concerns', label: 'Concerns', href: '/me/concerns' },
  { id: 'shelf', label: 'Shelf', href: '/me/shelf' },
  { id: 'routine', label: 'Routine', href: '/me/routine' },
] as const satisfies readonly WorkspaceNavigationDescriptor[];

export type MeWorkspaceTab = typeof ME_WORKSPACE_NAVIGATION[number]['id'];

export function createMeDockContext({
  tab,
  detail,
}: {
  tab: MeWorkspaceTab;
  detail: string;
}): DockContextDescriptor {
  const navigation = ME_WORKSPACE_NAVIGATION.find((item) => item.id === tab);
  if (!navigation) throw new Error(`Unknown JeloCare Me tab: ${tab}`);
  return {
    id: `me-${tab}`,
    label: navigation.label,
    detail,
    accessibleLabel: `${navigation.label}. ${detail}`,
  };
}
