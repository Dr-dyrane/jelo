import { ChevronRight } from 'lucide-react';
import { forwardRef } from 'react';
import type { DockContextDescriptor } from '@/lib/workspace-shell/dock-model';
import styles from './adaptive-workspace-dock.module.css';

export const DockContextCapsule = forwardRef<HTMLButtonElement, { context: DockContextDescriptor }>(function DockContextCapsule(
  { context },
  triggerRef,
) {
  const label = context.accessibleLabel ?? `${context.label}. ${context.detail}`;
  const content = (
    <>
      {context.label ? <span className={styles.contextLabel}>{context.label}</span> : null}
      <span className={styles.contextDetail}>{context.detail}</span>
      {context.compactDetail ? (
        <span className={styles.contextDetailCompact} aria-hidden="true">{context.compactDetail}</span>
      ) : null}
      {context.onInvoke ? <ChevronRight className={styles.contextChevron} size={16} aria-hidden="true" /> : null}
    </>
  );

  if (context.onInvoke) return (
    <button
      ref={triggerRef}
      type="button"
      className={`${styles.lens} ${styles.interactive} ${styles.context} ${styles.contextAction}`}
      aria-label={label}
      aria-expanded={context.controls ? context.expanded : undefined}
      aria-controls={context.controls}
      onClick={context.onInvoke}
      data-workspace-dock-context={context.id}
      data-workspace-dock-context-action
    >
      {content}
    </button>
  );

  return (
    <section
      className={`${styles.lens} ${styles.context}`}
      aria-label={label}
      data-workspace-dock-context={context.id}
    >
      {content}
    </section>
  );
});
