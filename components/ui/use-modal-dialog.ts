'use client';

import { useCallback, useEffect, useRef } from 'react';

type DialogWithOptionalMethods = HTMLDialogElement & {
  showModal?: () => void;
  close?: () => void;
};

interface UseModalDialogOptions {
  scrollOwnerSelector?: string;
  inertTargetSelectors?: readonly string[];
}

interface ModalEnvironment {
  scrollOwner: HTMLElement;
  previousOverflow: string;
  inertTargets: HTMLElement[];
  previousInert: boolean[];
}

const EMPTY_INERT_TARGETS: readonly string[] = [];

function focusableElements(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(item => !item.hasAttribute('hidden'));
}

export function useModalDialog({
  scrollOwnerSelector,
  inertTargetSelectors = EMPTY_INERT_TARGETS,
}: UseModalDialogOptions = {}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const environmentRef = useRef<ModalEnvironment | null>(null);

  const releaseEnvironment = useCallback(() => {
    const environment = environmentRef.current;
    if (!environment) return;

    environment.scrollOwner.style.overflow = environment.previousOverflow;
    environment.inertTargets.forEach((target, index) => {
      if (!environment.previousInert[index]) target.removeAttribute('inert');
    });
    environmentRef.current = null;
  }, []);

  const restore = useCallback(() => {
    releaseEnvironment();
    const trigger = triggerRef.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, [releaseEnvironment]);

  const close = useCallback(() => {
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
  }, [restore]);

  const open = useCallback(() => {
    const element = dialogRef.current as DialogWithOptionalMethods | null;
    if (!element || element.hasAttribute('open')) return;

    const scrollOwner = (
      scrollOwnerSelector
        ? document.querySelector<HTMLElement>(scrollOwnerSelector)
        : null
    ) ?? document.body;
    const inertTargets = inertTargetSelectors
      .map(selector => document.querySelector<HTMLElement>(selector))
      .filter((target): target is HTMLElement => (
        target != null
        && target !== element
        && !target.contains(element)
      ));

    environmentRef.current = {
      scrollOwner,
      previousOverflow: scrollOwner.style.overflow,
      inertTargets,
      previousInert: inertTargets.map(target => target.hasAttribute('inert')),
    };
    scrollOwner.style.overflow = 'hidden';
    inertTargets.forEach(target => target.setAttribute('inert', ''));

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
  }, [inertTargetSelectors, scrollOwnerSelector]);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    const dialogElement: HTMLDialogElement = element;

    function onClose() {
      restore();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!dialogElement.hasAttribute('open')) return;
      if (event.key === 'Escape') {
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
      releaseEnvironment();
    };
  }, [close, releaseEnvironment, restore]);

  return { dialogRef, triggerRef, open, close };
}
