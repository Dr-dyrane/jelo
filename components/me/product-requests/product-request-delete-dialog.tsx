'use client';

import { Trash2 } from 'lucide-react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import type { ProductRequest } from './product-request-model';
import styles from './product-request-detail.module.css';

export function ProductRequestDeleteDialog({
  request,
  disabled,
  pending,
  onConfirm,
}: {
  request: ProductRequest;
  disabled: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const {
    dialogRef,
    triggerRef,
    open,
    close,
  } = useModalDialog();

  function confirmDelete() {
    close();
    onConfirm();
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.deleteAction}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-controls="delete-product-request-dialog"
        onClick={open}
      >
        <Trash2 size={16} aria-hidden="true" /> Delete request
      </button>

      <dialog
        id="delete-product-request-dialog"
        ref={dialogRef}
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-product-request-title"
        aria-describedby="delete-product-request-consequences"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <section className={styles.deleteDialogPanel}>
          <header>
            <p>Private request</p>
            <h2 id="delete-product-request-title">Delete this request?</h2>
          </header>

          <dl className={styles.deleteIdentity} aria-label="Request being deleted">
            <div><dt>Brand</dt><dd>{request.brand}</dd></div>
            <div><dt>Full pack name</dt><dd>{request.fullPackName}</dd></div>
            <div><dt>Printed size or variant</dt><dd>{request.printedSizeVariant}</dd></div>
          </dl>

          <div id="delete-product-request-consequences" className={styles.deleteConsequences}>
            <p>Deleting this private request will:</p>
            <ul>
              <li>Remove it from your Shelf.</li>
              <li>Withdraw its research demand.</li>
              <li>Delete any private photo attached to it.</li>
            </ul>
            <strong>This cannot be undone.</strong>
          </div>

          <div className={styles.deleteDialogActions}>
            <button type="button" onClick={close}>Cancel</button>
            <button
              className={styles.confirmDeleteAction}
              type="button"
              disabled={pending}
              onClick={confirmDelete}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          </div>
        </section>
      </dialog>
    </>
  );
}
