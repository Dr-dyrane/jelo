"use client";

import { motion, useReducedMotion } from "framer-motion";
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
 */
export function SwipeableRail({ children, className }: SwipeableRailProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: 12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
