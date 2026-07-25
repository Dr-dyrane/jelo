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
  Activity
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

  const navItems = [
    { href: '/ops', label: 'Overview', icon: Home, count: null },
    { href: '/ops/contributions', label: 'Contributions', icon: Inbox, count: counts.contributions },
    { href: '/ops/edges', label: 'Edges', icon: GitFork, count: counts.edges },
    { href: '/ops/observations', label: 'Observations', icon: Eye, count: counts.observations },
    { href: '/ops/vocabulary', label: 'Vocabulary', icon: BookOpen, count: counts.values },
    { href: '/ops/retailers', label: 'Retailers', icon: Store, count: counts.retailers },
    { href: '/ops/signals', label: 'Signals', icon: Activity, count: null },
  ];

  // Derive initials for the avatar
  const initials = operator.role === 'admin' ? 'AD' : 'OP';

  return (
    <div className={styles.container}>
      {/* 1. Desktop Sidebar (>= 1024px) */}
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.barBrand}>
            <strong>JeloCare Ops</strong>
            <span>Moderation console</span>
          </div>
          <nav className={styles.nav}>
            {navItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                >
                  <span className={styles.linkContent}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
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

        <div className={styles.operator}>
          <div className={styles.operatorInitials}>{initials}</div>
          <div className={styles.operatorMeta} style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={operator.authSubject}>{operator.authSubject}</span>
            <span className={styles.role}>{operator.role}</span>
          </div>
        </div>
      </aside>

      {/* 2. Tablet Collapsed Rail (768px to 1023px) */}
      <aside className={styles.rail}>
        <div className={styles.railLogo}>J</div>
        <nav className={styles.railNav}>
          {navItems.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`${styles.railLink} ${isActive ? styles.railLinkActive : ''}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
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

      {/* 3. Mobile Header & Floating Tab Bar (< 768px) */}
      <div className={styles.contentWrapper}>
        <header className={styles.mobileHeader}>
          <div className={styles.barBrand}>
            <strong>JeloCare Ops</strong>
            <span>Moderation</span>
          </div>
          <div className={styles.operatorInitials} style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem' }}>
            {initials}
          </div>
        </header>

        <main className={styles.main}>{children}</main>

        <nav className={styles.mobileBar}>
          {navItems.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileLink} ${isActive ? styles.mobileLinkActive : ''}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span style={{ fontSize: '0.65rem' }}>{item.label}</span>
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
  );
}
