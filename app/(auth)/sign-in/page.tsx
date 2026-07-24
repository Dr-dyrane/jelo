'use client';

import { type FormEvent, useState } from 'react';
import { authClient } from '@/lib/auth/client';
import styles from './sign-in.module.css';

type Phase = 'email' | 'code';

// Email one-time-code, the passwordless method this Neon Auth instance exposes
// (magic-link is not provisioned). Two steps by design: the code field is
// withheld until the email is in, so disclosure is progressive rather than a
// wall of fields. Feedback stays quiet — the button label carries state, errors
// are a single muted line, never a loud banner.
export default function OpsSignIn() {
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function interpret(err: unknown, fallback: string): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 404) return 'Sign-in is not switched on yet. Try again shortly.';
    if (status === 429) return 'Too many attempts. Wait a moment, then try again.';
    return fallback;
  }

  async function requestCode(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' });
      if (err) throw err;
      setCode('');
      setPhase('code');
    } catch (err) {
      console.error('otp-send', err);
      setError(interpret(err, 'Could not send the code. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
      if (err) throw err;
      // Full navigation so the server re-runs the operator guard with the new session.
      window.location.assign('/ops');
    } catch (err) {
      console.error('otp-verify', err);
      setError(interpret(err, 'That code did not match. Check it and try again.'));
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>JeloCare Ops</p>
        {phase === 'email' ? (
          <form onSubmit={event => { event.preventDefault(); void requestCode(); }}>
            <h1 className={styles.h1}>Operator sign in.</h1>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@jelocare.com"
              aria-label="Operator email"
              className={styles.input}
              disabled={busy}
            />
            <button type="submit" className={styles.button} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Continue'}
            </button>
            {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <h1 className={styles.h1}>Enter your code.</h1>
            <p className={styles.meta}>
              Sent to {email}
              <button
                type="button"
                className={styles.link}
                onClick={() => { setPhase('email'); setCode(''); setError(''); }}
              >
                Change
              </button>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              aria-label="Six-digit code"
              className={`${styles.input} ${styles.otp}`}
              disabled={busy}
            />
            <button type="submit" className={styles.button} disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            {error ? <p role="alert" className={styles.error}>{error}</p> : null}
            <button type="button" className={styles.resend} onClick={() => void requestCode()} disabled={busy}>
              Resend code
            </button>
          </form>
        )}
        <p className={styles.foot}>Access is limited to allowlisted operators.</p>
      </div>
      <p role="status" aria-live="polite" className={styles.srStatus}>
        {busy ? 'Working…' : phase === 'code' ? 'Code sent. Enter it to continue.' : ''}
      </p>
    </main>
  );
}
