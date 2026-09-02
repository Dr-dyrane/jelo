"use client";

/* eslint-disable @next/next/no-img-element -- Native onError fallback is required for retailer-hosted catalogue images. */

import { useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  fallback?: React.ReactNode;
};

const fallback = "/product-placeholder.svg";

export function SafeProductImage({
  src,
  alt,
  className,
  priority = false,
  fallback: fallbackContent,
}: Props) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);

  if (failed && fallbackContent !== undefined) {
    return <>{fallbackContent}</>;
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (fallbackContent !== undefined) {
          setFailed(true);
          return;
        }
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
