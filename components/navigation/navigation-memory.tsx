"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAVIGATION_MEMORY_KEY = "jelocare:navigation-memory";

type NavigationMemoryState = {
  current: string;
  previous?: string;
};

export function readNavigationMemory(): NavigationMemoryState | null {
  try {
    const value = window.sessionStorage.getItem(NAVIGATION_MEMORY_KEY);
    return value ? (JSON.parse(value) as NavigationMemoryState) : null;
  } catch {
    return null;
  }
}

export function NavigationMemory() {
  const pathname = usePathname();

  useEffect(() => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const stored = readNavigationMemory();
    if (stored?.current === current) return;
    const next: NavigationMemoryState = {
      current,
      previous: stored?.current,
    };
    window.sessionStorage.setItem(NAVIGATION_MEMORY_KEY, JSON.stringify(next));
  }, [pathname]);

  return null;
}
