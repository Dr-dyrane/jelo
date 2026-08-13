'use client';

import { Check, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useBasket } from './basket-provider';
import styles from './procurement-actions.module.css';

export function AddToBasketButton({ slug }: { slug: string }) {
  const basket = useBasket();
  const [added, setAdded] = useState(false);
  const inBasket = basket.items.some(item => item.slug === slug);

  if (inBasket && added) {
    return (
      <Link className={styles.basketLink} href="/basket">
        <Check size={18} aria-hidden="true" /> View basket
      </Link>
    );
  }

  return (
    <button
      className={styles.addButton}
      type="button"
      onClick={() => {
        basket.add(slug);
        setAdded(true);
      }}
    >
      <ShoppingBag size={18} aria-hidden="true" />
      {inBasket ? 'Add another' : 'Add to basket'}
    </button>
  );
}
