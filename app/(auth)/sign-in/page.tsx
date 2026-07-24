'use client';

import { type FormEvent, useState } from 'react';
import { authClient } from '@/lib/auth/client';
import styles from './sign-in.module.css';

type State = 'idle' | 'sending' | 'sent' | 'error';

export default function OpsSignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState('sending');
    setMessage('');
    try {
      const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: '/ops' });
      if (error) throw new Error(error.message ?? 'Sign-in failed.');
      setState('sent');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <strong>JeloCare Ops</strong>
          <span>Moderation console</span>
        </div>
        {state === 'sent' ? (
          <div className={styles.sent}>
            <h1 className={styles.h1}>Check your email</h1>
            <p>A one-time sign-in link is on its way to <strong>{email}</strong>. Open it on this device to enter the console.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className={styles.form}>
            <h1 className={styles.h1}>Operator sign in</h1>
            <p className={styles.lede}>Internal only. Enter your operator email to receive a one-time sign-in link.</p>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@jelocare.com"
              className={styles.input}
              disabled={state === 'sending'}
            />
            {state === 'error' ? <p className={styles.error} role="alert">{message}</p> : null}
            <button type="submit" className={styles.button} disabled={state === 'sending' || !email.trim()}>
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
        <p className={styles.foot}>Access is limited to allowlisted operators.</p>
      </div>
    </main>
  );
}
