'use client';

import { useEffect } from 'react';
import {
  catalogueTransitionStorageKey,
  createCatalogueTransition,
  parseCatalogueTransition,
  type CatalogueTransitionKind,
} from '@/lib/catalogue/catalogue-interactions';

type TransitionSnapshot = {
  href: string;
  transition: ReturnType<typeof parseCatalogueTransition>;
};

let transitionSnapshot: TransitionSnapshot = { href: '', transition: null };
const transitionListeners = new Set<() => void>();

function publishTransition(next: TransitionSnapshot) {
  transitionSnapshot = next;
  for (const listener of transitionListeners) listener();
}

export function subscribeCatalogueTransition(listener: () => void) {
  transitionListeners.add(listener);
  return () => {
    transitionListeners.delete(listener);
  };
}

export function getCatalogueTransitionSnapshot(currentHref: string) {
  return transitionSnapshot.href === currentHref ? transitionSnapshot.transition : null;
}

function storeTransition(from: string | URL, to: string | URL, kind?: CatalogueTransitionKind) {
  const transition = createCatalogueTransition(from, to, kind);
  if (!transition) {
    try {
      window.sessionStorage.removeItem(catalogueTransitionStorageKey);
    } catch {
      // Storage is optional; navigation should still work without feedback.
    }
    return null;
  }
  try {
    window.sessionStorage.setItem(catalogueTransitionStorageKey, JSON.stringify(transition));
  } catch {
    return null;
  }
  return transition;
}

export function recordCatalogueTransition(to: string, kind?: CatalogueTransitionKind) {
  if (typeof window === 'undefined') return null;
  return storeTransition(window.location.href, new URL(to, window.location.href), kind);
}

export function consumeCatalogueTransition(currentHref: string) {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(catalogueTransitionStorageKey);
    window.sessionStorage.removeItem(catalogueTransitionStorageKey);
  } catch {
    return null;
  }
  return parseCatalogueTransition(raw, new URL(currentHref, window.location.origin));
}

function getFormDestination(form: HTMLFormElement) {
  if ((form.method || 'get').toLowerCase() !== 'get') return null;
  const destination = new URL(form.action || window.location.href, window.location.href);
  const query = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (typeof value === 'string') query.append(key, value);
  }
  destination.search = query.toString();
  return destination;
}

export function CatalogueTransitionTracker({ currentHref }: { currentHref: string }) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!element || element.download || (element.target && element.target !== '_self')) return;
      const destination = new URL(element.href, window.location.href);
      if (window.location.pathname !== '/products' || destination.origin !== window.location.origin || destination.pathname !== '/products') return;
      const requestedKind = element.dataset.catalogueTransitionKind;
      storeTransition(
        window.location.href,
        destination,
        requestedKind === 'undo' ? 'undo' : undefined,
      );
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || window.location.pathname !== '/products') return;
      const destination = getFormDestination(form);
      if (!destination || destination.origin !== window.location.origin || destination.pathname !== '/products') return;
      storeTransition(window.location.href, destination);
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    publishTransition({ href: currentHref, transition: consumeCatalogueTransition(currentHref) });
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      if (transitionSnapshot.href === currentHref) publishTransition({ href: '', transition: null });
    };
  }, [currentHref]);

  return null;
}
