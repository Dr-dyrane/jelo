'use client';

import type { DockContextDescriptor } from '@/lib/workspace-shell/dock-model';
import { DockContextCapsule } from './dock-context';
import { DockFab } from './dock-fab';
import {
  ActivePageOrb,
  DockNavigation,
  type WorkspaceDockNavigateHandler,
  type WorkspaceDockNavigationItem,
} from './dock-navigation';
import type { AdaptiveWorkspaceDockController } from './use-adaptive-workspace-dock-controller';
import { useWorkspaceDockFab } from './workspace-dock-provider';
import styles from './adaptive-workspace-dock.module.css';

export function AdaptiveWorkspaceDock({
  controller,
  navigationItems,
  currentHref,
  context,
  onNavigate,
  className,
}: {
  controller: AdaptiveWorkspaceDockController;
  navigationItems: readonly WorkspaceDockNavigationItem[];
  currentHref: string;
  context?: DockContextDescriptor;
  onNavigate?: WorkspaceDockNavigateHandler;
  className?: string;
}) {
  const fab = useWorkspaceDockFab();
  const mode = controller.mode;
  const hasNavigation = navigationItems.length > 0;
  const classes = [styles.root, className].filter(Boolean).join(' ');
  const navigation = (revealed = false) => hasNavigation ? (
    <DockNavigation
      items={navigationItems}
      currentHref={currentHref}
      revealed={revealed}
      onNavigate={(item, event) => {
        controller.dismissNavigation();
        onNavigate?.(item, event);
      }}
    />
  ) : null;

  if (!hasNavigation && !context && !fab) return null;

  return (
    <aside
      className={classes}
      aria-label="Workspace dock"
      data-adaptive-workspace-dock
      data-workspace-dock-mode={mode}
    >
      {mode === 'expanded' && context ? (
        <div className={styles.expanded}>
          <DockContextCapsule context={context} />
          <div className={styles.row}>
            {navigation()}
            {fab ? <DockFab fab={fab} /> : null}
          </div>
        </div>
      ) : null}

      {mode === 'compact' && context ? (
        <div className={styles.row}>
          <ActivePageOrb
            items={navigationItems}
            currentHref={currentHref}
            onReveal={controller.revealNavigation}
          />
          <DockContextCapsule context={context} />
          {fab ? <DockFab fab={fab} /> : null}
        </div>
      ) : null}

      {mode === 'navigation' ? (
        <div className={styles.row}>
          {navigation(true)}
          {fab ? <DockFab fab={fab} /> : null}
        </div>
      ) : null}

      {mode === 'single' ? (
        <div className={styles.row}>
          {hasNavigation ? navigation() : context ? <DockContextCapsule context={context} /> : null}
          {fab ? <DockFab fab={fab} /> : null}
        </div>
      ) : null}
    </aside>
  );
}

export type { WorkspaceDockNavigationItem, WorkspaceDockNavigateHandler };
export type { DockContextDescriptor } from '@/lib/workspace-shell/dock-model';
