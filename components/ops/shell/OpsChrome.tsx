'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BookOpen, Eye, GitFork, History, Home, Inbox, PanelLeft, Store, UsersRound } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import type { ModerationOperator } from '@/lib/moderation/access';
import type { QueueCounts } from '@/lib/moderation/queues';
import type { OpsSidebarSummary } from '@/lib/moderation/sidebar-summary';
import { OpsSidebar, type OpsNavigationSection } from './OpsSidebar';
import styles from '@/app/(ops)/ops.module.css';
import adaptive from './ops-tablet.module.css';

interface OpsChromeProps {
  operator: ModerationOperator;
  counts: QueueCounts;
  sidebarSummary: OpsSidebarSummary;
  children: React.ReactNode;
}

export function OpsChrome({ operator, counts, sidebarSummary, children }: OpsChromeProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const timer = setTimeout(() => setTheme(activeTheme), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false);
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

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

  const navSections: OpsNavigationSection[] = [
    { label: 'Triage', items: queueItems },
    { label: 'Monitor', items: monitorItems },
    ...(manageItems.length > 0 ? [{ label: 'Manage', items: manageItems }] : []),
  ];

  const tabletDestinations = [
    { href: '/ops', label: 'Home' },
    { href: '/ops/contributions', label: 'Queue' },
    { href: '/ops/observations', label: 'Review' },
  ];

  return (
    <div className={styles.body}>
      <div className={styles.container} data-ops-shell data-sidebar-open={sidebarOpen ? 'true' : 'false'}>
        <div className={adaptive.sidebarLayer} data-ops-sidebar-layer>
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
          className={adaptive.sidebarScrim}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
          tabIndex={sidebarOpen ? 0 : -1}
        />

        <div data-ops-workspace className={`${styles.contentWrapper} ${adaptive.contentWrapper}`}>
          <nav className={adaptive.tabletIsland} aria-label="Primary operations navigation">
            <button
              type="button"
              className={adaptive.islandMenu}
              onClick={() => setSidebarOpen(open => !open)}
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={sidebarOpen}
            >
              <PanelLeft size={18} strokeWidth={1.9} />
            </button>
            {tabletDestinations.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`${adaptive.islandLink} ${pathname === item.href ? adaptive.islandLinkActive : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <main data-ops-main className={`${styles.main} ${adaptive.main}`}>{children}</main>
          <div data-ops-detail id="ops-detail-pane" className={`${styles.detailPane} ${adaptive.detailPane}`} aria-live="polite" />


        </div>
      </div>
    </div>
  );
}
