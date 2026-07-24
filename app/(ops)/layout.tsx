import type { Metadata } from 'next';
import Link from 'next/link';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from './ops.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Ops · JeloCare' },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/ops', label: 'Overview' },
  { href: '/ops/contributions', label: 'Contributions' },
  { href: '/ops/edges', label: 'Edges' },
  { href: '/ops/observations', label: 'Observations' },
  { href: '/ops/vocabulary', label: 'Vocabulary' },
  { href: '/ops/retailers', label: 'Retailers' },
  { href: '/ops/signals', label: 'Signals' },
];

// Console chrome. The html/body shell and theme come from the root layout. The
// guard is the security boundary AND hides the console's existence: an
// unauthorized request throws notFound() here, so the root not-found renders and
// no console chrome ever leaks. Every page re-runs the guard independently.
export default async function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const operator = await requireConsoleOperator();
  return (
    <div className={styles.body}>
      <header className={styles.bar}>
        <div className={styles.barBrand}>
          <strong>JeloCare Ops</strong>
          <span>Moderation console</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className={styles.operator}>
          <span>{operator.authSubject}</span>
          <span className={styles.role}>{operator.role}</span>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
