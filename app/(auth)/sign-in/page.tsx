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
      if (error) throw error;
      setState('sent');
    } catch (err) {
      // The technical detail goes to the console; the operator sees a calm line.
      console.error('sign-in', err);
      const status = (err as { status?: number } | null)?.status;
      setState('error');
      setMessage(status === 404
        ? 'Sign-in is not switched on yet. Try again shortly.'
        : 'Could not send the link. Please try again in a moment.');
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>JeloCare Ops</p>
        {state === 'sent' ? (
          <div className={styles.done}>
            <h1 className={styles.h1}>Check your email.</h1>
            <p className={styles.lede}>A sign-in link is on its way to {email}.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 className={styles.h1}>Operator sign in.</h1>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@jelocare.com"
              aria-label="Operator email"
              className={styles.input}
              disabled={state === 'sending'}
            />
            <button type="submit" className={styles.button} disabled={state === 'sending' || !email.trim()}>
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {state === 'error' ? <p role="alert" className={styles.error}>{message}</p> : null}
          </form>
        )}
        <p className={styles.foot}>Access is limited to allowlisted operators.</p>
      </div>
      <p role="status" aria-live="polite" className={styles.srStatus}>
        {state === 'sending' ? 'Sending your sign-in link.' : state === 'sent' ? 'Sign-in link sent. Check your email.' : ''}
      </p>
    </main>
  );
}
