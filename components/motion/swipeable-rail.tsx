"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

type SwipeableRailProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps a horizontally scrollable rail with a subtle entrance animation.
 * On mobile, the rail itself uses CSS scroll-snap for native swipe behavior.
 * This component adds a gentle "peek" entrance — the rail slides in from
 * the right by 12px and fades in when it enters the viewport.
 *
 * Respects prefers-reduced-motion.
 *
 * Uses useInView hook instead of whileInView prop for reliable detection
 * on client-side navigation (Next.js Link) where elements mount already
 * in the viewport.
 */
export function SwipeableRail({ children, className }: SwipeableRailProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  const initial = { opacity: 0, x: 12 };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={inView ? { opacity: 1, x: 0 } : initial}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
