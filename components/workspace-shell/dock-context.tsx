import type { DockContextDescriptor } from '@/lib/workspace-shell/dock-model';
import styles from './adaptive-workspace-dock.module.css';

export function DockContextCapsule({ context }: { context: DockContextDescriptor }) {
  return (
    <section
      className={`${styles.lens} ${styles.context}`}
      aria-label={context.accessibleLabel ?? `${context.label}. ${context.detail}`}
      data-workspace-dock-context={context.id}
    >
      <span className={styles.contextLabel}>{context.label}</span>
      <span className={styles.contextDetail}>{context.detail}</span>
    </section>
  );
}
