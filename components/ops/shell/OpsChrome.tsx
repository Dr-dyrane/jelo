'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Inbox,
  GitFork,
  Eye,
  BookOpen,
  Store,
  Activity,
  ChevronDown
} from 'lucide-react';
import type { ModerationOperator } from '@/lib/moderation/access';
import type { QueueCounts } from '@/lib/moderation/queues';
import styles from '@/app/(ops)/ops.module.css';

interface OpsChromeProps {
  operator: ModerationOperator;
  counts: QueueCounts;
  children: React.ReactNode;
}

export function OpsChrome({ operator, counts, children }: OpsChromeProps) {
  const pathname = usePathname();

  const queueItems = [
    { href: '/ops/contributions', label: 'Contributions', icon: Inbox, count: counts.contributions },
    { href: '/ops/edges', label: 'Edges', icon: GitFork, count: counts.edges },
    { href: '/ops/observations', label: 'Observations', icon: Eye, count: counts.observations },
    { href: '/ops/vocabulary', label: 'Vocabulary', icon: BookOpen, count: counts.values },
    { href: '/ops/retailers', label: 'Retailers', icon: Store, count: counts.retailers },
  ];

  const systemItems = [
    { href: '/ops', label: 'Overview', icon: Home, count: null },
    { href: '/ops/signals', label: 'Signals', icon: Activity, count: null },
  ];

  const allItems = [...systemItems, ...queueItems];

  const initials = operator.role === 'admin' ? 'AD' : 'OP';

  return (
    <div className={styles.body}>
      <div className={styles.container}>
        {/* 1. Desktop Sidebar (Linear Mirror) */}
        <aside className={styles.sidebar}>
          <div>
            {/* Workspace Selector */}
            <div className={styles.workspaceHeader}>
              <div className={styles.workspaceIcon}>JC</div>
              <div className={styles.workspaceMeta}>
                <strong>JeloCare Ops</strong>
                <span>Moderation Console</span>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
            </div>

            {/* Navigation Group: Queues */}
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>Triage Queues</div>
              <nav className={styles.nav}>
                {queueItems.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    >
                      <span className={styles.linkContent}>
                        <Icon size={14} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? 'var(--wine)' : 'inherit' }} />
                        <span>{item.label}</span>
                      </span>
                      {item.count != null && item.count > 0 ? (
                        <span className={`${styles.badge} ${isActive ? styles.badgeActive : ''}`}>
                          {item.count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Navigation Group: System */}
            <div className={styles.navGroup}>
              <div className={styles.navGroupTitle}>System</div>
              <nav className={styles.nav}>
                {systemItems.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    >
                      <span className={styles.linkContent}>
                        <Icon size={14} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? 'var(--wine)' : 'inherit' }} />
                        <span>{item.label}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* User Footer Profile */}
          <div className={styles.operator}>
            <div className={styles.operatorInitials}>{initials}</div>
            <div className={styles.operatorMeta}>
              <span title={operator.authSubject}>{operator.authSubject}</span>
              <span className={styles.role}>{operator.role}</span>
            </div>
          </div>
        </aside>

        {/* 2. Tablet Collapsed Rail */}
        <aside className={styles.rail}>
          <div className={styles.railLogo}>JC</div>
          <nav className={styles.railNav}>
            {allItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`${styles.railLink} ${isActive ? styles.railLinkActive : ''}`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  {item.count != null && item.count > 0 ? (
                    <span className={styles.railBadge}>{item.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className={styles.operatorInitials} title={`${operator.authSubject} (${operator.role})`}>
            {initials}
          </div>
        </aside>

        {/* 3. Mobile Header & Floating Bottom Tab Bar */}
        <div className={styles.contentWrapper}>
          <header className={styles.mobileHeader}>
            <div className={styles.workspaceHeader} style={{ padding: 0 }}>
              <div className={styles.workspaceIcon} style={{ width: '18px', height: '18px', fontSize: '9px' }}>JC</div>
              <div className={styles.workspaceMeta} style={{ marginLeft: '4px' }}>
                <strong style={{ fontSize: '11px' }}>JeloCare Ops</strong>
              </div>
            </div>
            <div className={styles.operatorInitials} style={{ width: '18px', height: '18px', fontSize: '9px' }}>
              {initials}
            </div>
          </header>

          <main className={styles.main}>{children}</main>

          <nav className={styles.mobileBar}>
            {allItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.mobileLink} ${isActive ? styles.mobileLinkActive : ''}`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span>{item.label}</span>
                  {item.count != null && item.count > 0 ? (
                    <span className={styles.railBadge} style={{ top: '-4px', right: '-4px' }}>
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
