'use client';

import { ChevronRight, Equal, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import styles from './site-header.module.css';

const mobileLinks = [
  { href: '/concerns', label: 'Concerns', detail: 'Start with what you notice' },
  { href: '/products', label: 'Products', detail: 'Find what fits' },
  { href: '/contribute', label: 'Contribute', detail: 'Add what you know' },
  { href: '/consult', label: 'Ask JeloCare', detail: 'Create a simple guide' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const open = openPathname === pathname;
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const { dialogRef: menuDialogRef, triggerRef: menuTriggerRef, open: openMenu, close: closeMenu } = useModalDialog();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setScrolled(window.scrollY > 48));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (event.key === 'Escape') {
        setOpenPathname(null);
        return;
      }

      if ((!isTyping && event.key === '/') || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setOpenPathname(pathname);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpenPathname(null);
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
    <>
      <header className={`${styles.header} ${isHome && !scrolled ? styles.homeHeader : ''} ${scrolled ? styles.scrolled : ''} ${open ? styles.searchOpen : ''}`}>
        <Link className={styles.logo} href="/">JELOCARE</Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <div className={styles.links} aria-hidden={open}>
            <Link href="/concerns">Concerns</Link>
            <Link href="/products">Products</Link>
            <Link href="/contribute">Contribute</Link>
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
                  placeholder="Search products, companies or concerns"
                  aria-label="Search products, companies or concerns"
                />
                <button className={styles.closeSearch} type="button" onClick={() => setOpenPathname(null)} aria-label="Close search">
                  <X size={17} />
                </button>
              </>
            ) : (
              <button className={styles.searchTrigger} type="button" onClick={() => setOpenPathname(pathname)} aria-label="Open search" aria-expanded="false">
                <Search size={18} />
                <span>Search</span>
              </button>
            )}
          </form>

          <button className={styles.menuTrigger} type="button" ref={menuTriggerRef} onClick={openMenu} aria-haspopup="dialog" aria-controls="mobile-navigation">
            <Equal size={19} aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </button>
        </nav>
      </header>

      <dialog
        className={styles.menuDialog}
        id="mobile-navigation"
        ref={menuDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        onClick={event => { if (event.target === menuDialogRef.current) closeMenu(); }}
      >
        <div className={styles.menuSheet}>
          <header className={styles.menuHeading}>
            <div><p>Explore</p><h2 id="mobile-navigation-title">JeloCare</h2></div>
            <button type="button" onClick={closeMenu} aria-label="Close menu"><X size={19} aria-hidden="true" /></button>
          </header>
          <nav className={styles.mobileLinks} aria-label="Mobile navigation">
            {mobileLinks.map(link => (
              <Link href={link.href} onClick={closeMenu} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? 'page' : undefined} key={link.href}>
                <span><strong>{link.label}</strong><small>{link.detail}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className={styles.mobileSecondary}>
            <Link href="/ingredients" onClick={closeMenu}>Ingredients</Link>
            <Link href="/retailers" onClick={closeMenu}>Retailers</Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
