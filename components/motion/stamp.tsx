"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type StampProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

/**
 * Trust mark entrance. The element scales from 1.15 → 0.98 → 1 with a
 * warm radial flash behind it, like a pharmacist's approval stamp
 * landing on the page.
 *
 * The overshoot is small — it's a stamp, not a bounce. The timing is
 * deliberate (0.5s) — slower than a typical entrance, because trust
 * should feel earned.
 *
 * Respects prefers-reduced-motion by rendering children at scale 1.
 */
export function Stamp({ children, delay = 0, className }: StampProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 1.15 }}
      whileInView={{ opacity: 1, scale: [1.15, 0.98, 1] }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.2, 0.8, 0.2, 1],
        scale: { duration: 0.5, times: [0, 0.7, 1], ease: [0.2, 0.8, 0.2, 1] },
      }}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      <motion.span
        aria-hidden
        initial={{ opacity: 0 }}
        whileInView={{ opacity: [0.3, 0] }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: delay + 0.1 }}
        style={{
          position: "absolute",
          inset: "-0.5rem",
          borderRadius: "inherit",
          background:
            "radial-gradient(circle, var(--peach, #f4d4c5) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
    </motion.span>
  );
}
