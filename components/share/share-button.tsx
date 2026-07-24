'use client';

import { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Share2, X } from 'lucide-react';
import styles from './share-button.module.css';

const SITE = 'https://www.jelocare.com';

export function ShareButton({
  path,
  title,
  label = 'Share',
  quiet = false,
  inline = false,
}: {
  path: string;
  title: string;
  label?: string;
  quiet?: boolean;
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const url = typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : `${SITE}${path}`;

  function openSheet() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  }
  function closeSheet() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    try {
      dialog.close();
    } catch {
      dialog.removeAttribute('open');
    }
  }

  async function onPrimary() {
    // Mobile and share-capable browsers hand off to the native share sheet.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Share sheet dismissed; leave the page as-is.
      }
      return;
    }
    // Desktop: open the share sheet.
    openSheet();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked; nothing else to do quietly.
    }
    closeSheet();
  }

  function viewPage() {
    closeSheet();
    if (pathname !== path) router.push(path);
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const className = inline ? styles.inline : `${styles.btn} ${quiet ? styles.quiet : ''}`;
  const iconSize = inline ? 13 : 16;

  return (
    <>
      <button type="button" className={className} onClick={onPrimary} aria-haspopup="dialog">
        {copied ? <Check size={iconSize} aria-hidden /> : <Share2 size={iconSize} aria-hidden />}
        {copied ? 'Link copied' : label}
      </button>

      <dialog
        ref={dialogRef}
        className={styles.sheet}
        aria-label="Share this product"
        onClick={event => { if (event.target === event.currentTarget) closeSheet(); }}
      >
        <div className={styles.sheetInner}>
          <span className={styles.grip} aria-hidden />
          <header className={styles.sheetHead}>
            <strong>Share</strong>
            <button type="button" onClick={closeSheet} aria-label="Close"><X size={18} aria-hidden /></button>
          </header>
          <a className={styles.opt} href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={closeSheet}>WhatsApp</a>
          <a className={styles.opt} href={tweet} target="_blank" rel="noopener noreferrer" onClick={closeSheet}>X</a>
          <button className={styles.opt} type="button" onClick={copyLink}>Copy link</button>
          {pathname !== path ? <button className={styles.opt} type="button" onClick={viewPage}>View page</button> : null}
        </div>
      </dialog>
    </>
  );
}
