'use client';

import { useEffect, useRef } from 'react';

type DialogWithOptionalMethods = HTMLDialogElement & {
  showModal?: () => void;
  close?: () => void;
};

function focusableElements(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(item => !item.hasAttribute('hidden'));
}

export function useModalDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef('');

  function restore() {
    document.body.style.overflow = previousOverflow.current;
    triggerRef.current?.focus();
  }

  function close() {
    const element = dialogRef.current as DialogWithOptionalMethods | null;
    if (!element?.hasAttribute('open')) return;
    if (element.dataset.fallbackModal !== 'true' && typeof element.close === 'function') {
      try {
        element.close();
        return;
      } catch {
        // Fall through to the attribute-based close for partial dialog support.
      }
    }
    element.removeAttribute('open');
    delete element.dataset.fallbackModal;
    restore();
  }

  function open() {
    const element = dialogRef.current as DialogWithOptionalMethods | null;
    if (!element || element.hasAttribute('open')) return;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (typeof element.showModal === 'function') {
      try {
        element.showModal();
      } catch {
        // Older embedded browsers can expose showModal without supporting it.
      }
    }
    if (!element.hasAttribute('open')) {
      element.dataset.fallbackModal = 'true';
      element.setAttribute('open', '');
    }
    queueMicrotask(() => focusableElements(element)[0]?.focus());
  }

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    const dialogElement: HTMLDialogElement = element;

    function onClose() {
      restore();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!dialogElement.hasAttribute('open')) return;
      if (event.key === 'Escape' && dialogElement.dataset.fallbackModal === 'true') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(dialogElement);
      if (!focusable.length) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialogElement.addEventListener('close', onClose);
    dialogElement.addEventListener('keydown', onKeyDown);
    return () => {
      dialogElement.removeEventListener('close', onClose);
      dialogElement.removeEventListener('keydown', onKeyDown);
      if (dialogElement.hasAttribute('open')) document.body.style.overflow = previousOverflow.current;
    };
  });

  return { dialogRef, triggerRef, open, close };
}
