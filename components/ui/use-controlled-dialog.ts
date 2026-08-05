'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useModalDialog } from './use-modal-dialog';

type ControlledDialogOptions = {
  open: boolean;
  onClose: () => void;
  /**
   * Element to focus when the dialog closes. If omitted, the hook's
   * internal triggerRef is used (attach it to the dialog trigger button).
   */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Element to focus when the dialog opens. If omitted, the first
   * focusable element inside the dialog receives focus.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  scrollOwnerSelector?: string;
  inertTargetSelectors?: readonly string[];
};

/**
 * Adapter around `useModalDialog` for components whose open/close state
 * is controlled by a parent prop. Syncs the external `open` boolean with
 * the hook's imperative `open()` / `close()` methods and provides a
 * consistent focus-restore contract.
 */
export function useControlledDialog({
  open,
  onClose,
  restoreFocusRef,
  initialFocusRef,
  scrollOwnerSelector,
  inertTargetSelectors,
}: ControlledDialogOptions) {
  const { dialogRef, triggerRef, open: openDialog, close: closeDialog } = useModalDialog({
    scrollOwnerSelector,
    inertTargetSelectors,
  });
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      openDialog();
      if (initialFocusRef?.current) {
        queueMicrotask(() => initialFocusRef.current?.focus({ preventScroll: true }));
      }
    } else {
      closeDialog();
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        const target = restoreFocusRef?.current;
        if (target?.isConnected) target.focus({ preventScroll: true });
      }
    }
  }, [open, openDialog, closeDialog, restoreFocusRef, initialFocusRef]);

  const handleCancel = useCallback((event: React.SyntheticEvent) => {
    event.preventDefault();
    onCloseRef.current();
  }, []);

  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onCloseRef.current();
  }, []);

  return {
    dialogRef,
    triggerRef,
    handleCancel,
    handleBackdropClick,
  };
}
