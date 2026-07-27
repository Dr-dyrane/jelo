'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const OPS_OVERLAY_INERT_TARGETS = [
  '[data-ops-workspace]',
  '[data-ops-sidebar-layer]',
  '[data-ops-detail]',
  '[data-ops-menu-fab]',
] as const;

export const OPS_MODAL_DIALOG_OPTIONS = {
  scrollOwnerSelector: '[data-ops-main]',
  inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS,
} as const;

function isRendered(element: HTMLElement, boundary: HTMLElement) {
  let current: HTMLElement | null = element;

  while (current) {
    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (current === boundary) break;
    current = current.parentElement;
  }

  return true;
}

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(element => (
      !element.hasAttribute('hidden')
      && element.getAttribute('aria-hidden') !== 'true'
      && !element.closest('[inert]')
      && isRendered(element, dialog)
    ));
}

interface UseOpsOverlayOptions {
  open: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  returnFocusRef: RefObject<HTMLElement | null>;
  inertTargetSelectors: readonly string[];
  initialFocusSelector?: string;
  scrollOwnerSelector?: string;
}

/**
 * Shared interaction contract for temporary Ops sheets and modals.
 * Route components still own their content and responsive presentation.
 */
export function useOpsOverlay({
  open,
  onClose,
  dialogRef,
  returnFocusRef,
  inertTargetSelectors,
  initialFocusSelector,
  scrollOwnerSelector = '[data-ops-main]',
}: UseOpsOverlayOptions) {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) return;

    wasOpen.current = true;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeDialog = dialog;

    const scrollOwner = document.querySelector<HTMLElement>(scrollOwnerSelector);
    const previousOverflow = scrollOwner?.style.overflow ?? '';
    const inertTargets = inertTargetSelectors
      .map(selector => document.querySelector<HTMLElement>(selector))
      .filter((target): target is HTMLElement => target != null && !target.contains(activeDialog));
    const previousInert = inertTargets.map(target => target.hasAttribute('inert'));

    if (scrollOwner) scrollOwner.style.overflow = 'hidden';
    inertTargets.forEach(target => target.setAttribute('inert', ''));

    function focusInitialTarget() {
      const requestedTarget = initialFocusSelector
        ? activeDialog.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const target = requestedTarget && isRendered(requestedTarget, activeDialog)
        ? requestedTarget
        : focusableElements(activeDialog)[0] ?? activeDialog;
      target.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      const nestedDialog = event.target instanceof Element
        ? event.target.closest('dialog[open]')
        : null;
      if (nestedDialog && nestedDialog !== activeDialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = focusableElements(activeDialog);
      if (focusable.length === 0) {
        event.preventDefault();
        activeDialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!activeDialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const focusFrame = requestAnimationFrame(focusInitialTarget);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (scrollOwner) scrollOwner.style.overflow = previousOverflow;
      inertTargets.forEach((target, index) => {
        if (!previousInert[index]) target.removeAttribute('inert');
      });
    };
  }, [
    dialogRef,
    inertTargetSelectors,
    initialFocusSelector,
    onClose,
    open,
    scrollOwnerSelector,
  ]);

  useEffect(() => {
    if (open || !wasOpen.current) return;

    wasOpen.current = false;
    const focusTarget = returnFocusRef.current;
    const focusFrame = requestAnimationFrame(() => {
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(focusFrame);
  }, [open, returnFocusRef]);
}
