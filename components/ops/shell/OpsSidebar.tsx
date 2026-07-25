'use client';

import { ChevronDown, LogOut, Moon, Sun, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ModerationOperator } from '@/lib/moderation/access';
import type { OpsSidebarSummary } from '@/lib/moderation/sidebar-summary';
import styles from '@/app/(ops)/ops.module.css';

type Theme = 'light' | 'dark';

export type OpsNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number | null;
};

export type OpsNavigationSection = {
  label: string;
  items: OpsNavigationItem[];
};

type OpsSidebarProps = {
  operator: ModerationOperator;
  summary: OpsSidebarSummary;
  pathname: string;
  sections: OpsNavigationSection[];
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onSignOut: () => void;
};

function operatorInitials(label: string) {
  return label
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';
}

export function OpsSidebar({ operator, summary, pathname, sections, theme, onThemeChange, onSignOut }: OpsSidebarProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const initials = operatorInitials(summary.displayName);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <aside data-ops-sidebar className={styles.sidebar} aria-label="Operations navigation">
      <div className={styles.sidebarTop}>
        <div className={styles.accountMenu} ref={accountMenuRef}>
          <button
            type="button"
            className={styles.accountTrigger}
            onClick={() => setIsAccountMenuOpen(open => !open)}
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
          >
            <span className={styles.operatorAvatar} aria-hidden="true">{initials}</span>
            <span className={styles.accountIdentity}>
              <strong>{summary.displayName}</strong>
              <span>{operator.role}</span>
            </span>
            <ChevronDown className={styles.accountChevron} size={14} aria-hidden="true" />
          </button>

          {isAccountMenuOpen ? (
            <div className={styles.accountPopover} role="menu">
              <div className={styles.accountPopoverIdentity}>
                <strong>{summary.displayName}</strong>
                <span>{summary.email}</span>
                <span>{operator.role}</span>
              </div>
              <dl className={styles.accountActivity}>
                <div>
                  <dt>Today</dt>
                  <dd>{summary.decisionsToday} decisions</dd>
                </div>
                <div>
                  <dt>Last action</dt>
                  <dd>{summary.lastActionLabel}</dd>
                </div>
              </dl>
              <button type="button" className={styles.accountSignOut} role="menuitem" onClick={onSignOut}>
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        <nav className={styles.sidebarNavigation} aria-label="Operations sections">
          <p className={styles.sidebarContext}>Operations</p>
          {sections.map(section => (
            <div className={styles.navGroup} key={section.label}>
              <p className={styles.navGroupTitle}>{section.label}</p>
              <div className={styles.nav}>
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className={styles.linkContent}>
                        <Icon size={15} strokeWidth={isActive ? 2.25 : 1.9} aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      {item.count ? <span className={styles.badge}>{item.count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.themeToggleBar} aria-label="Appearance">
          <button
            type="button"
            className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`}
            onClick={() => onThemeChange('light')}
            aria-label="Use light appearance"
            aria-pressed={theme === 'light'}
          >
            <Sun size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`}
            onClick={() => onThemeChange('dark')}
            aria-label="Use dark appearance"
            aria-pressed={theme === 'dark'}
          >
            <Moon size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
