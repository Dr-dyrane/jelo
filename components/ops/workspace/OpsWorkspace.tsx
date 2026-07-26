'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from '@/app/(ops)/ops.module.css';

export interface OpsWorkspaceTab {
  href: string;
  label: string;
}

interface OpsWorkspaceProps {
  title: string;
  tabs?: OpsWorkspaceTab[];
  children: React.ReactNode;
}

export function OpsWorkspace({ title, tabs, children }: OpsWorkspaceProps) {
  const pathname = usePathname();

  return (
    <>
      <div className={styles.workspaceHead}>
        <h1 className={styles.workspaceTitle}>{title}</h1>
        {tabs && tabs.length > 0 ? (
          <nav className={styles.workspaceTabs} aria-label="Workspace views">
            {tabs.map(tab => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`${styles.workspaceTab} ${isActive ? styles.workspaceTabActive : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
      {children}
    </>
  );
}
