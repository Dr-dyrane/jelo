import { useEffect, useRef, type MouseEvent } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  resolveActiveWorkspaceNavigationItem,
  type WorkspaceNavigationDescriptor,
} from '@/lib/workspace-shell/dock-model';
import styles from './adaptive-workspace-dock.module.css';

export type WorkspaceDockNavigationItem = WorkspaceNavigationDescriptor & {
  icon: LucideIcon;
};

export type WorkspaceDockNavigateHandler = (
  item: WorkspaceDockNavigationItem,
  event: MouseEvent<HTMLAnchorElement>,
) => void;

export function DockNavigation({
  items,
  currentHref,
  revealed = false,
  onNavigate,
}: {
  items: readonly WorkspaceDockNavigationItem[];
  currentHref: string;
  revealed?: boolean;
  onNavigate?: WorkspaceDockNavigateHandler;
}) {
  const active = resolveActiveWorkspaceNavigationItem(items, currentHref);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!revealed) return;
    const frame = window.requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealed]);

  return (
    <nav
      ref={rootRef}
      className={`${styles.lens} ${styles.navigation}`}
      aria-label="Primary navigation"
      data-workspace-dock-navigation-reveal={revealed || undefined}
    >
      <ul
        className={styles.navigationList}
        role="list"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const selected = item.id === active?.id;
          const Icon = item.icon;
          return (
            <li key={item.id} className={styles.navigationListItem}>
              <Link
                href={item.href}
                className={`${styles.interactive} ${styles.navigationItem}`}
                aria-current={selected ? 'page' : undefined}
                aria-label={item.label}
                onClick={(event) => onNavigate?.(item, event)}
              >
                <Icon size={22} strokeWidth={selected ? 2.2 : 1.65} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ActivePageOrb({
  items,
  currentHref,
  onReveal,
}: {
  items: readonly WorkspaceDockNavigationItem[];
  currentHref: string;
  onReveal: () => void;
}) {
  const item = resolveActiveWorkspaceNavigationItem(items, currentHref) ?? items[0];
  if (!item) return null;
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`${styles.lens} ${styles.interactive} ${styles.pageOrb}`}
      onClick={onReveal}
      aria-label={`Show navigation. ${item.label} selected`}
      data-workspace-dock-page-orb={item.id}
    >
      <Icon size={25} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
