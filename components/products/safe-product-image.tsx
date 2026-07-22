'use client';

/* eslint-disable @next/next/no-img-element -- Native onError fallback is required for retailer-hosted catalogue images. */

import { useState } from 'react';

type Props = {
  src: string;
  alt: string;
  className?: string;
};

const fallback = '/product-placeholder.svg';

export function SafeProductImage({ src, alt, className }: Props) {
  const [current, setCurrent] = useState(src);
  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
