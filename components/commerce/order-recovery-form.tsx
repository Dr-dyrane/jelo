'use client';

import { useState } from 'react';
import styles from './order-status.module.css';

export function OrderRecoveryForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <form className={styles.recoveryForm} onSubmit={async event => {
      event.preventDefault();
      setPending(true);
      const data = new FormData(event.currentTarget);
      try {
        const response = await fetch('/api/orders/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: data.get('reference'), contactEmail: data.get('contactEmail') }),
        });
        setMessage(response.ok
          ? 'If those details match an active request, a new private link is on its way.'
          : 'Check the reference and email, then try again.');
      } catch {
        setMessage('The connection was interrupted. Try again.');
      }
      setPending(false);
    }}>
      <label><span>Order reference</span><input name="reference" placeholder="JC-0000000000" required pattern="JC-[A-Za-z0-9]{10}" /></label>
      <label><span>Email</span><input name="contactEmail" type="email" required autoComplete="email" /></label>
      <button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send a new private link'}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
