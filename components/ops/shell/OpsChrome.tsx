'use client';

import { useState, useEffect } from 'react';
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
  ChevronDown,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { authClient } from '@/lib/auth/client';
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync theme state on load safely without triggering cascading synchronous renders
  useEffect(() => {
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const timer = setTimeout(() => {
      setTheme(activeTheme);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = (targetTheme: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', targetTheme);
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

  const systemItems = [
    { href: '/ops', label: 'Overview', icon: Home, count: null },
    { href: '/ops/signals', label: 'Signals', icon: Activity, count: null },
  ];

  const allItems = [...systemItems, ...queueItems];

  // Resolve short name and avatar from email/subject
  const emailVal = operator.authSubject;
  const isEmail = emailVal.includes('@');
  const shortNamePlaceholder = isEmail 
    ? emailVal.split('@')[0].replace(/[^a-zA-Z]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Operator ' + emailVal.slice(0, 4);

  const avatarPlaceholder = shortNamePlaceholder
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';

  return (
    <div className={styles.body}>
      <div className={styles.container}>
        {/* 1. Desktop Sidebar */}
        <aside className={styles.sidebar}>
          <div>
            {/* Unified User & Workspace Selector Dropdown (Linear style) */}
            <div className={styles.workspaceHeader} title={`${emailVal} (${operator.role})`}>
              <div className={styles.operatorAvatarWrapper}>
                <div className={styles.operatorAvatar}>{avatarPlaceholder}</div>
                <div className={styles.statusDot} title="Live session connection active" />
              </div>
              <div className={styles.workspaceMeta} style={{ marginLeft: '6px' }}>
                <span className={styles.brandLogo}>JELOCARE</span>
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.01em' }}>
                  {shortNamePlaceholder} ({operator.role})
                </span>
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

            {/* Triage Progress Card */}
            <div className={styles.statsPanel}>
              <div className={styles.statRow} style={{ justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 500 }}>12 triaged today</span>
              </div>
            </div>
          </div>

          {/* Footer Area */}
          <div className={styles.footerArea}>
            {/* Theme Toggle switcher */}
            <div className={styles.themeToggleBar}>
              <button 
                type="button"
                className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`}
                onClick={() => toggleTheme('light')}
                title="Light Mode"
              >
                <Sun size={13} />
              </button>
              <button 
                type="button"
                className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`}
                onClick={() => toggleTheme('dark')}
                title="Dark Mode"
              >
                <Moon size={13} />
              </button>
            </div>

            {/* Logout button */}
            <button 
              type="button" 
              className={styles.footerLogoutBtn}
              onClick={handleSignOut}
              title="Sign out of console"
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* 2. Tablet Collapsed Rail */}
        <aside className={styles.rail}>
          <div className={styles.railLogo} style={{ fontFamily: 'var(--font-display), serif', fontWeight: 400 }}>J</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.themeBtn}
              onClick={() => toggleTheme(theme === 'light' ? 'dark' : 'light')}
              style={{ width: '32px', height: '32px' }}
            >
              {theme === 'light' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div className={styles.operatorInitials} title={`${emailVal} (${operator.role})`}>
              {avatarPlaceholder}
            </div>
          </div>
        </aside>

        {/* 3. Mobile Header & Floating Bottom Tab Bar */}
        <div className={styles.contentWrapper}>
          <header className={styles.mobileHeader}>
            <div className={styles.workspaceHeader} style={{ padding: 0 }}>
              <div className={styles.workspaceMeta} style={{ marginLeft: '4px' }}>
                <strong style={{ fontSize: '11px', fontFamily: 'var(--font-display)', letterSpacing: '.05em' }}>JELOCARE</strong>
              </div>
            </div>
            <div className={styles.operatorInitials} style={{ width: '18px', height: '18px', fontSize: '9px' }}>
              {avatarPlaceholder}
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
