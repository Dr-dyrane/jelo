"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
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
 *
 * Uses useInView hook instead of whileInView prop for reliable detection
 * on client-side navigation (Next.js Link) where elements mount already
 * in the viewport.
 */
export function Stamp({ children, delay = 0, className }: StampProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  if (reduce) {
    return <span className={className}>{children}</span>;
  }

  const initial = { opacity: 0, scale: 1.15 };

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={initial}
      animate={inView ? { opacity: 1, scale: [1.15, 0.98, 1] } : initial}
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
        animate={inView ? { opacity: [0.3, 0] } : { opacity: 0 }}
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
