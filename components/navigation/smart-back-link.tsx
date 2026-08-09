"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { readNavigationMemory } from "./navigation-memory";

export function SmartBackLink({
  fallbackHref,
  className,
  children,
}: {
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const memory = readNavigationMemory();
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const remembersPreviousPage =
      memory?.current === current &&
      Boolean(memory.previous) &&
      memory.previous !== memory.current;
    if (remembersPreviousPage && memory?.previous) {
      event.preventDefault();
      router.push(memory.previous);
      return;
    }

    const referrer = document.referrer;
    const cameFromJeloCare = referrer
      ? new URL(referrer).origin === window.location.origin
      : false;
    const canUseNativeBack =
      window.history.length > 1 && (cameFromJeloCare || !referrer);
    if (!canUseNativeBack) return;

    event.preventDefault();
    router.back();
  }

  return (
    <Link className={className} href={fallbackHref} onClick={handleClick}>
      {children}
    </Link>
  );
}
