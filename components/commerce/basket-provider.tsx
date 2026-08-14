'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  addBasketItem,
  BASKET_EVENT,
  BASKET_STORAGE_KEY,
  basketAddOutcome,
  basketQuantity,
  normaliseBasketItems,
  setBasketItemQuantity,
  type BasketAddOutcome,
  type BasketItem,
} from '@/lib/commerce/basket';

type BasketNotice = 'product_limit_reached' | null;

type BasketContextValue = {
  items: BasketItem[];
  totalQuantity: number;
  ready: boolean;
  notice: BasketNotice;
  add: (slug: string) => BasketAddOutcome;
  setQuantity: (slug: string, quantity: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  replace: (items: BasketItem[]) => void;
};

const BasketContext = createContext<BasketContextValue | null>(null);
const EMPTY_BASKET: BasketItem[] = [];
let cachedRaw = '';
let cachedItems = EMPTY_BASKET;

function readStoredBasket() {
  try {
    const raw = localStorage.getItem(BASKET_STORAGE_KEY) ?? '[]';
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    cachedItems = normaliseBasketItems(JSON.parse(raw));
    return cachedItems;
  } catch {
    return EMPTY_BASKET;
  }
}

function subscribeToBasket(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(BASKET_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(BASKET_EVENT, onStoreChange);
  };
}

function subscribeToHydration() {
  return () => {};
}

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribeToBasket, readStoredBasket, () => EMPTY_BASKET);
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [notice, setNotice] = useState<BasketNotice>(null);

  const replace = useCallback((nextItems: BasketItem[]) => {
    const normalised = normaliseBasketItems(nextItems);
    localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(normalised));
    window.dispatchEvent(new Event(BASKET_EVENT));
    setNotice(null);
  }, []);

  const add = useCallback((slug: string): BasketAddOutcome => {
    const outcome = basketAddOutcome(items, slug);
    if (outcome === 'product_limit_reached') {
      setNotice(outcome);
      return outcome;
    }
    replace(addBasketItem(items, slug));
    return outcome;
  }, [items, replace]);

  const value = useMemo<BasketContextValue>(() => ({
    items,
    totalQuantity: basketQuantity(items),
    ready,
    notice,
    add,
    setQuantity: (slug, quantity) => replace(setBasketItemQuantity(items, slug, quantity)),
    remove: slug => replace(items.filter(item => item.slug !== slug)),
    clear: () => replace([]),
    replace,
  }), [add, items, notice, ready, replace]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const value = useContext(BasketContext);
  if (!value) throw new Error('useBasket must be used inside BasketProvider.');
  return value;
}
