'use client';

import Link from 'next/link';
import { MessageCircleQuestion, Pipette } from 'lucide-react';
import { ME_WORKSPACE_NAVIGATION } from './me-shell-model';
import styles from '@/components/me/home/me-home.module.css';

export function MeRouteState({
  state,
  onRetry,
}: {
  state: 'loading' | 'error';
  onRetry?: () => void;
}) {
  const loading = state === 'loading';
  return (
    <div className={styles.shell}>
      <div className={styles.safeAreaTop} aria-hidden="true" />
      <header className={styles.topbar}>
        <Link href="/me" className={styles.brand}>JeloCare</Link>
        <span className={styles.stateIdentity}>JeloCare Me</span>
      </header>
      <main
        className={styles.scroll}
        aria-busy={loading || undefined}
        aria-label={loading ? 'Loading JeloCare Me' : undefined}
      >
        <div className={styles.content}>
          <section className={styles.routePage} aria-labelledby="me-route-state-title">
            <div className={styles.routeHeading}>
              <h1 id="me-route-state-title">Home</h1>
            </div>
            <div className={styles.emptyAction} role={loading ? 'status' : 'alert'}>
              <Pipette size={24} strokeWidth={1.5} aria-hidden="true" />
              <p>{loading ? 'Opening Home…' : 'Home is unavailable right now.'}</p>
              {!loading && onRetry ? (
                <button className={styles.retryAction} type="button" onClick={onRetry}>Try again</button>
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <div className={styles.stateDock} aria-label="JeloCare Me workspace">
        <nav aria-label="JeloCare Me">
          {ME_WORKSPACE_NAVIGATION.map(item => (
            <Link key={item.id} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <Link className={styles.stateFab} href="/me/consult" aria-label="Ask Me">
          <MessageCircleQuestion size={22} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
