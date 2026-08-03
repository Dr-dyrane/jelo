'use client';

import Link from 'next/link';
import { ArrowRight, CircleUserRound, LogOut, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { ThemeToggle } from '@/components/navigation/theme-toggle';
import { authClient } from '@/lib/auth/client';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import styles from './me-account-sheet.module.css';

export type MeAccountHelperItem = {
  id: string;
  label: string;
  href: string;
};

// Helper destinations are added only when their real authenticated pages ship.
export const ME_ACCOUNT_HELPER_ITEMS: readonly MeAccountHelperItem[] = [];

export function MeAccountSheet({
  account,
  open,
  onClose,
  triggerRef,
}: {
  account: CustomerPortalViewModel['account'];
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const body = document.body;
    const trigger = triggerRef.current;
    const previousOverflow = body.style.overflow;
    const previousOverscroll = body.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscroll;
      trigger?.focus({ preventScroll: true });
    };
  }, [open, triggerRef]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!account.synthetic) {
        const result = await authClient.signOut();
        if (result.error) throw result.error;
      }
      window.location.assign('/sign-in?next=/me');
    } catch (err) {
      console.error('customer-sign-out', err);
      setError('Could not sign out. Try again.');
      setBusy(false);
    }
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function closeFromEscape(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function closeFromKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  }

  if (!open) return null;

  return (
    <dialog
      id="me-account-sheet"
      ref={dialogRef}
      className={styles.dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="me-account-sheet-title"
      onCancel={closeFromEscape}
      onKeyDown={closeFromKeyDown}
      onClick={closeFromBackdrop}
    >
      <section
        className={styles.sheet}
        aria-describedby={account.email ? 'me-account-sheet-email' : undefined}
      >
        <header className={styles.heading}>
          <div>
            <p>JeloCare Me</p>
            <h2 id="me-account-sheet-title">My Account</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close account">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.identity}>
          <span aria-hidden="true"><CircleUserRound size={26} strokeWidth={1.6} /></span>
          <div>
            <strong>{account.displayName ?? 'My JeloCare'}</strong>
            {account.email ? <p id="me-account-sheet-email">{account.email}</p> : null}
          </div>
        </div>

        <div className={styles.appearance}>
          <div>
            <strong>Appearance</strong>
          </div>
          <ThemeToggle />
        </div>

        {ME_ACCOUNT_HELPER_ITEMS.length ? (
          <nav className={styles.helpers} aria-label="Account helpers">
            {ME_ACCOUNT_HELPER_ITEMS.map((item) => (
              <Link key={item.id} href={item.href} onClick={onClose}>
                {item.label} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        ) : null}

        <footer className={styles.footer}>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            <LogOut size={18} aria-hidden="true" />
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </footer>
      </section>
    </dialog>
  );
}
