'use client';

import { ArrowDown, Heart, ShieldCheck, Timer } from 'lucide-react';
import type { MouseEvent } from 'react';
import styles from '@/app/contribute/contribute.module.css';

const signals = [
  { id: 'anonymous', icon: ShieldCheck, title: 'Anonymous', label: 'No account' },
  { id: 'time', icon: Timer, title: 'About a minute', label: 'One step at a time' },
  { id: 'impact', icon: Heart, title: 'Helps someone', label: 'Every note counts' },
] as const;

export function ContributionTrustSignals() {
  function begin(event: MouseEvent<HTMLAnchorElement>) {
    const experience = document.getElementById('contribution-form');
    if (!experience) return;
    event.preventDefault();
    window.history.replaceState(null, '', '#contribution-form');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    experience.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => {
      experience.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')?.focus({
        preventScroll: true,
      });
    }, reducedMotion ? 0 : 450);
  }

  return <nav className={styles.trust} aria-label="Start sharing">
    {signals.map(signal => {
      const Icon = signal.icon;
      return <a key={signal.id} href="#contribution-form" onClick={begin}>
        <Icon size={18} aria-hidden="true" />
        <span><strong>{signal.title}</strong><small>{signal.label}</small></span>
        <ArrowDown className={styles.trustArrow} size={16} aria-hidden="true" />
      </a>;
    })}
  </nav>;
}
