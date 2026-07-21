'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import styles from './site-header.module.css';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    window.location.assign(`/products?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className={styles.header}>
      <Link className={styles.logo} href="/">JELOCARE</Link>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link href="/concerns">Concerns</Link>
        <Link href="/products">Products</Link>
        <Link href="/consult">Consult</Link>
        <button className={styles.searchTrigger} type="button" onClick={() => setOpen(true)} aria-label="Open search" aria-expanded={open}>
          <Search size={18} />
          <span>Search</span>
        </button>
      </nav>

      {open ? (
        <div className={styles.searchLayer} role="dialog" aria-modal="true" aria-label="Search JeloCare">
          <button className={styles.scrim} type="button" aria-label="Close search" onClick={() => setOpen(false)} />
          <div className={styles.searchPanel}>
            <form onSubmit={submit}>
              <Search size={21} aria-hidden="true" />
              <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products, brands or concerns" aria-label="Search products, brands or concerns" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search"><X size={18} /></button>
            </form>
            <p>Press Enter to search the catalogue.</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
