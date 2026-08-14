'use client';

import { Suspense, type FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import {
  OTP_RESEND_COOLDOWN_MS,
  otpResendSeconds,
  otpSignInErrorMessage,
} from '@/lib/auth/otp-sign-in';
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
  const requestedContinuations = searchParams.getAll('next');
  const continuation = resolveSignInContinuation(
    requestedContinuations.length === 1 ? requestedContinuations[0] : requestedContinuations,
  );
  const intent = resolveSignInIntent(continuation);
  const customerIntent = intent === 'customer';
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const sendInFlight = useRef(false);
  const verifyInFlight = useRef(false);

  useEffect(() => {
    if (phase !== 'code' || resendAvailableAt === null) return;

    let timeoutId: number | undefined;
    const updateCountdown = () => {
      const seconds = otpResendSeconds(resendAvailableAt);
      setResendSeconds(seconds);
      if (seconds > 0) timeoutId = window.setTimeout(updateCountdown, 1000);
    };
    updateCountdown();
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [phase, resendAvailableAt]);

  async function requestCode(): Promise<void> {
    const normalizedEmail = email.trim();
    const isResend = phase === 'code';
    if (!normalizedEmail || sendInFlight.current || verifyInFlight.current) return;
    if (isResend && resendAvailableAt !== null && Date.now() < resendAvailableAt) return;

    sendInFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: 'sign-in',
      });
      if (err) throw err;
      const availableAt = Date.now() + OTP_RESEND_COOLDOWN_MS;
      setCode('');
      setNotice(
        isResend
          ? 'A new code was requested. Use the newest code.'
          : 'Enter the newest code from your inbox.',
      );
      setResendAvailableAt(availableAt);
      setResendSeconds(otpResendSeconds(availableAt));
      setPhase('code');
    } catch (err) {
      console.error('otp-send', err);
      setError(otpSignInErrorMessage(err, 'send'));
    } finally {
      sendInFlight.current = false;
      setBusy(false);
    }
  }

  async function verifyCode(event?: FormEvent, targetCode?: string): Promise<void> {
    if (event) event.preventDefault();
    const finalCode = (targetCode ?? code).trim();
    if (finalCode.length !== 6 || sendInFlight.current || verifyInFlight.current) return;

    verifyInFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: finalCode,
      });
      if (err) throw err;
      // Full navigation so the destination's verified server-session guard runs.
      if (continuation === '/ops') {
        window.location.assign('/ops');
        return;
      }
      window.location.assign(continuation);
    } catch (err) {
      console.error('otp-verify', err);
      setError(otpSignInErrorMessage(err, 'verify'));
    } finally {
      verifyInFlight.current = false;
      setBusy(false);
    }
  }

  const codeGuidance = resendSeconds > 0
    ? notice
    : 'Nothing yet? Check spam, then request a new code.';

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
              {busy ? 'Requesting…' : 'Continue'}
            </button>
            {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <h1 className={styles.h1}>Enter your code.</h1>
            <p className={styles.meta}>
              Check {email}
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setPhase('email');
                  setCode('');
                  setError('');
                  setNotice('');
                  setResendAvailableAt(null);
                  setResendSeconds(0);
                }}
                disabled={busy}
              >
                Change
              </button>
            </p>
            <p id="otp-guidance" className={styles.guidance}>{codeGuidance}</p>
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
                setError('');
                if (nextVal.length === 6) void verifyCode(undefined, nextVal);
              }}
              placeholder="000000"
              aria-label="Six-digit code"
              aria-describedby={error ? 'otp-guidance otp-error' : 'otp-guidance'}
              className={`${styles.input} ${styles.otp}`}
              disabled={busy}
            />
            <button type="submit" className={styles.button} disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            {error ? <p id="otp-error" role="alert" className={styles.error}>{error}</p> : null}
            <button
              type="button"
              className={styles.resend}
              onClick={() => void requestCode()}
              disabled={busy || resendSeconds > 0}
            >
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
            </button>
          </form>
        )}
        <p className={styles.foot}>
          {customerIntent ? 'One private code. No password.' : 'Access is limited to allowlisted operators.'}
        </p>
      </div>
      <p role="status" aria-live="polite" className={styles.srStatus}>
        {busy ? 'Working…' : phase === 'code' ? codeGuidance : ''}
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
