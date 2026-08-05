'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useRef, type RefObject } from 'react';
import { useControlledDialog } from '@/components/ui/use-controlled-dialog';
import type { MeContextSheetModel } from './me-context-model';
import styles from './me-account-sheet.module.css';

export function MeContextSheet({
  model,
  open,
  onClose,
  triggerRef,
}: {
  model: MeContextSheetModel;
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useControlledDialog({
    open,
    onClose,
    restoreFocusRef: triggerRef,
    initialFocusRef: closeRef,
  });

  if (!open) return null;

  return (
    <dialog
      id="me-context-sheet"
      ref={dialogRef}
      className={styles.dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="me-context-sheet-title"
      aria-describedby="me-context-sheet-summary"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <section className={styles.sheet}>
        <header className={styles.heading}>
          <div>
            <p>{model.eyebrow}</p>
            <h2 id="me-context-sheet-title">{model.title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close page summary">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.identity}>
          <span aria-hidden="true"><Sparkles size={25} strokeWidth={1.6} /></span>
          <div>
            <strong id="me-context-sheet-summary">{model.summary}</strong>
          </div>
        </div>

        {model.items.length ? (
          <nav className={styles.helpers} aria-label={`${model.title} shortcuts`}>
            {model.items.map((item) => (
              <Link key={item.id} href={item.href} onClick={onClose}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        ) : null}
      </section>
    </dialog>
  );
}
