'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BookOpen, Eye, GitFork, History, Home, Inbox, Menu, Moon, Store, Sun, UsersRound, X } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import type { ModerationOperator } from '@/lib/moderation/access';
import type { QueueCounts } from '@/lib/moderation/queues';
import type { OpsSidebarSummary } from '@/lib/moderation/sidebar-summary';
import { OpsSidebar, type OpsNavigationSection } from './OpsSidebar';
import styles from '@/app/(ops)/ops.module.css';
import tablet from './ops-tablet.module.css';

interface OpsChromeProps {
  operator: ModerationOperator;
  counts: QueueCounts;
  sidebarSummary: OpsSidebarSummary;
  children: React.ReactNode;
}

export function OpsChrome({ operator, counts, sidebarSummary, children }: OpsChromeProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false);

  useEffect(() => {
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const timer = setTimeout(() => setTheme(activeTheme), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setTabletSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!tabletSidebarOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setTabletSidebarOpen(false);
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [tabletSidebarOpen]);

  const toggleTheme = (targetTheme: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', targetTheme);
    document.documentElement.style.colorScheme = targetTheme;
    try {
      localStorage.setItem('jelo-theme', targetTheme);
    } catch {
      // The selected appearance remains active for the current visit.
    }
    setTheme(targetTheme);
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      window.location.assign('/sign-in');
    } catch (err) {
      console.error('Sign-out error:', err);
      window.location.assign('/sign-in');
    }
  };

  const queueItems = [
    { href: '/ops/contributions', label: 'Contributions', icon: Inbox, count: counts.contributions },
    { href: '/ops/edges', label: 'Edges', icon: GitFork, count: counts.edges },
    { href: '/ops/observations', label: 'Observations', icon: Eye, count: counts.observations },
    { href: '/ops/vocabulary', label: 'Vocabulary', icon: BookOpen, count: counts.values },
    { href: '/ops/retailers', label: 'Retailers', icon: Store, count: counts.retailers },
  ];

  const monitorItems = [
    { href: '/ops', label: 'Queue overview', icon: Home, count: null },
    { href: '/ops/activity', label: 'Decision history', icon: History, count: null },
    { href: '/ops/signals', label: 'Signals', icon: Activity, count: null },
  ];

  const manageItems = operator.role === 'admin'
    ? [{ href: '/ops/operators', label: 'Operators', icon: UsersRound, count: null }]
    : [];
  const allItems = [...monitorItems, ...queueItems, ...manageItems];
  const navSections: OpsNavigationSection[] = [
    { label: 'Triage', items: queueItems },
    { label: 'Monitor', items: monitorItems },
    ...(manageItems.length > 0 ? [{ label: 'Manage', items: manageItems }] : []),
  ];

  const currentDestination = useMemo(
    () => allItems.find(item => item.href === pathname) ?? { label: 'Operations', count: null },
    [allItems, pathname],
  );

  const avatarPlaceholder = sidebarSummary.displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';

  return (
    <div className={styles.body}>
      <div className={styles.container} data-ops-shell data-tablet-sidebar-open={tabletSidebarOpen ? 'true' : 'false'}>
        <div className={tablet.sidebarLayer} data-ops-sidebar-layer>
          <OpsSidebar
            operator={operator}
            summary={sidebarSummary}
            pathname={pathname}
            sections={navSections}
            theme={theme}
            onThemeChange={toggleTheme}
            onSignOut={handleSignOut}
          />
        </div>

        <button
          type="button"
          className={tablet.sidebarScrim}
          onClick={() => setTabletSidebarOpen(false)}
          aria-label="Close navigation"
          tabIndex={tabletSidebarOpen ? 0 : -1}
        />

        <aside className={`${styles.rail} ${tablet.rail}`}>
          <div className={styles.railLogo} style={{ fontFamily: 'var(--font-display), serif', fontWeight: 400 }}>J</div>
          <nav className={styles.railNav}>
            {allItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} title={item.label} className={`${styles.railLink} ${isActive ? styles.railLinkActive : ''}`}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  {item.count != null && item.count > 0 ? <span className={styles.railBadge}>{item.count}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button type="button" className={styles.themeBtn} onClick={() => toggleTheme(theme === 'light' ? 'dark' : 'light')} style={{ width: '32px', height: '32px' }}>
              {theme === 'light' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div className={styles.operatorInitials} title={`${sidebarSummary.displayName} (${operator.role})`}>{avatarPlaceholder}</div>
          </div>
        </aside>

        <div data-ops-workspace className={`${styles.contentWrapper} ${tablet.contentWrapper}`}>
          <header className={`${styles.mobileHeader} ${tablet.tabletHeader}`}>
            <button
              type="button"
              className={tablet.headerButton}
              onClick={() => setTabletSidebarOpen(open => !open)}
              aria-label={tabletSidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={tabletSidebarOpen}
            >
              {tabletSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className={tablet.headerIdentity}>
              <strong>{currentDestination.label}</strong>
              {currentDestination.count != null ? <span>{currentDestination.count} pending</span> : <span>JeloCare Ops</span>}
            </div>
            <div className={styles.operatorInitials} style={{ width: '28px', height: '28px', fontSize: '10px' }}>{avatarPlaceholder}</div>
          </header>

          <main data-ops-main className={`${styles.main} ${tablet.main}`}>{children}</main>
          <div data-ops-detail id="ops-detail-pane" className={`${styles.detailPane} ${tablet.detailPane}`} aria-live="polite" />
          <nav className={styles.mobileBar}>
            {allItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`${styles.mobileLink} ${isActive ? styles.mobileLinkActive : ''}`}>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span>{item.label}</span>
                  {item.count != null && item.count > 0 ? <span className={styles.railBadge} style={{ top: '-4px', right: '-4px' }}>{item.count}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
