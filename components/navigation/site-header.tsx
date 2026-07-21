'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import styles from './site-header.module.css';

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }

      if ((!isTyping && event.key === '/') || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    window.location.assign(`/products?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className={`${styles.header} ${isHome ? styles.homeHeader : ''} ${open ? styles.searchOpen : ''}`}>
      <Link className={styles.logo} href="/">JELOCARE</Link>

      <nav className={styles.nav} aria-label="Primary navigation">
        <div className={styles.links} aria-hidden={open}>
          <Link href="/concerns">Concerns</Link>
          <Link href="/products">Products</Link>
          <Link href="/consult">Consult</Link>
        </div>

        <form ref={searchRef} className={styles.inlineSearch} onSubmit={submit} role="search">
          {open ? (
            <>
              <Search className={styles.searchIcon} size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search products, brands or concerns"
                aria-label="Search products, brands or concerns"
              />
              <button className={styles.closeSearch} type="button" onClick={() => setOpen(false)} aria-label="Close search">
                <X size={17} />
              </button>
            </>
          ) : (
            <button className={styles.searchTrigger} type="button" onClick={() => setOpen(true)} aria-label="Open search" aria-expanded="false">
              <Search size={18} />
              <span>Search</span>
            </button>
          )}
        </form>
      </nav>
    </header>
  );
}
