import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Italiana, Manrope } from 'next/font/google';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import '../globals.css';
import styles from './ops.module.css';

const display = Italiana({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Ops · JeloCare',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { colorScheme: 'light dark' };

const themeScript = `(function(){try{var t=localStorage.getItem('jelo-theme');var m=t==='dark'?'dark':'light';var e=document.documentElement;e.setAttribute('data-theme',m);e.style.colorScheme=m;}catch(err){var e=document.documentElement;e.setAttribute('data-theme','light');e.style.colorScheme='light';}})();`;

const NAV = [
  { href: '/ops', label: 'Overview' },
  { href: '/ops/contributions', label: 'Contributions' },
  { href: '/ops/edges', label: 'Edges' },
  { href: '/ops/observations', label: 'Observations' },
  { href: '/ops/vocabulary', label: 'Vocabulary' },
  { href: '/ops/retailers', label: 'Retailers' },
  { href: '/ops/signals', label: 'Signals' },
];

// A root layout for the internal console, fully separate from the public shell:
// no public header, footer, or Analytics. The guard here provides the operator
// identity for the chrome; it is NOT the security boundary — every page and action
// runs requireConsoleOperator independently.
export default async function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const operator = await requireConsoleOperator();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className={styles.body}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
      </body>
    </html>
  );
}
