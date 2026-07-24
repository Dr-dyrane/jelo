import Link from 'next/link';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import styles from './boundary.module.css';

export default function NotFound() {
  return (
    <div className={styles.shell}>
      <main className={styles.body}>
        <p className={styles.eyebrow}>JeloCare</p>
        <h1 className={styles.h1}>Nothing here.</h1>
        <p className={styles.lede}>This page moved, or never existed.</p>
        <Link href="/" className={styles.action}>Back to JeloCare</Link>
      </main>
      <footer className={styles.foot}>
        <ThemeToggle />
        <span>© {new Date().getFullYear()} Dyrane · Guidance, not diagnosis.</span>
      </footer>
    </div>
  );
}
