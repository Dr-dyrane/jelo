import { LoaderCircle } from 'lucide-react';
import type { WorkspaceDockFabDescriptor } from './workspace-dock-provider';
import styles from './adaptive-workspace-dock.module.css';

export function DockFab({ fab }: { fab: WorkspaceDockFabDescriptor }) {
  const Icon = fab.icon;
  return (
    <button
      type="button"
      className={`${styles.lens} ${styles.interactive} ${styles.fab}`}
      onClick={fab.onInvoke}
      disabled={fab.disabled || fab.busy}
      aria-label={fab.label}
      aria-busy={fab.busy || undefined}
      data-workspace-dock-fab={fab.ownerId}
    >
      {fab.busy ? (
        <LoaderCircle className={styles.spinner} size={24} strokeWidth={1.9} aria-hidden="true" />
      ) : (
        <Icon size={26} strokeWidth={2.05} aria-hidden="true" />
      )}
    </button>
  );
}
