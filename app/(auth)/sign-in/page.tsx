'use client';

import { Suspense, type FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { resolveSignInContinuation, resolveSignInIntent } from '@/lib/auth/sign-in-intent';
import styles from './sign-in.module.css';

type Phase = 'email' | 'code';

// Email one-time-code, the passwordless method this Neon Auth instance exposes
// (magic-link is not provisioned). Two steps by design: the code field is
// withheld until the email is in, so disclosure is progressive rather than a
// wall of fields. Feedback stays quiet — the button label carries state, errors
// are a single muted line, never a loud banner.
function SignInForm() {
  const searchParams = useSearchParams();
  const continuation = resolveSignInContinuation(searchParams.get('next'));
  const intent = resolveSignInIntent(continuation);
  const customerIntent = intent === 'customer';
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

  async function verifyCode(event?: FormEvent, targetCode?: string): Promise<void> {
    if (event) event.preventDefault();
    const finalCode = (targetCode ?? code).trim();
    if (finalCode.length < 6 || busy) return;

    setBusy(true);
    setError('');
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email: email.trim(), otp: finalCode });
      if (err) throw err;
      // Full navigation so the destination's verified server-session guard runs.
      if (continuation === '/ops') {
        window.location.assign('/ops');
        return;
      }
      window.location.assign('/me');
    } catch (err) {
      console.error('otp-verify', err);
      setError(interpret(err, 'That code did not match. Check it and try again.'));
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{customerIntent ? 'JeloCare Me' : 'JeloCare Ops'}</p>
        {phase === 'email' ? (
          <form onSubmit={event => { event.preventDefault(); void requestCode(); }}>
            <h1 className={styles.h1}>{customerIntent ? 'Come back to your care.' : 'Operator sign in.'}</h1>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder={customerIntent ? 'you@example.com' : 'you@jelocare.com'}
              aria-label={customerIntent ? 'Email address' : 'Operator email'}
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
              onChange={event => {
                const nextVal = event.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(nextVal);
                if (nextVal.length === 6 && !busy) {
                  void verifyCode(undefined, nextVal);
                }
              }}
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
        <p className={styles.foot}>
          {customerIntent ? 'One private code. No password.' : 'Access is limited to allowlisted operators.'}
        </p>
      </div>
      <p role="status" aria-live="polite" className={styles.srStatus}>
        {busy ? 'Working…' : phase === 'code' ? 'Code sent. Enter it to continue.' : ''}
      </p>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className={styles.shell} aria-label="JeloCare sign in" />}>
      <SignInForm />
    </Suspense>
  );
}
