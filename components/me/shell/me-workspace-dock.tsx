'use client';

import { CircleUserRound, Compass, House, LibraryBig, Rows3 } from 'lucide-react';
import {
  AdaptiveWorkspaceDock,
  type WorkspaceDockNavigateHandler,
  type WorkspaceDockNavigationItem,
} from '@/components/workspace-shell/adaptive-workspace-dock';
import type { AdaptiveWorkspaceDockController } from '@/components/workspace-shell/use-adaptive-workspace-dock-controller';
import type { DockContextDescriptor } from '@/lib/workspace-shell/dock-model';
import { ME_RELEASED_WORKSPACE_NAVIGATION } from './me-shell-model';

const icons = {
  home: House,
  explore: Compass,
  shelf: LibraryBig,
  routine: Rows3,
} as const;

const ME_DOCK_ITEMS: readonly WorkspaceDockNavigationItem[] =
  ME_RELEASED_WORKSPACE_NAVIGATION.map((item) => ({ ...item, icon: icons[item.id] }));

export function MeWorkspaceDock({
  controller,
  currentHref,
  context,
  onNavigate,
}: {
  controller: AdaptiveWorkspaceDockController;
  currentHref: string;
  context: DockContextDescriptor;
  onNavigate?: WorkspaceDockNavigateHandler;
}) {
  return (
    <AdaptiveWorkspaceDock
      controller={controller}
      navigationItems={ME_DOCK_ITEMS}
      currentHref={currentHref}
      context={context}
      onNavigate={onNavigate}
    />
  );
}

// Account remains avatar-owned chrome and deliberately stays outside the four Me tabs.
export const MeAccountAvatarIcon = CircleUserRound;
