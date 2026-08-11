"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

type KenBurnsProps = {
  children: ReactNode;
  className?: string;
  scale?: number;
  duration?: number;
};

/**
 * Ken Burns drift effect. Slowly scales and pans an image to make it
 * feel alive — like looking through a window. The effect is very slow
 * (20s by default) and subtle (scale 1 → 1.08).
 *
 * Respects prefers-reduced-motion by rendering children without motion.
 *
 * Uses useInView hook instead of whileInView prop for reliable detection
 * on client-side navigation (Next.js Link) where elements mount already
 * in the viewport.
 */
export function KenBurns({
  children,
  className,
  scale = 1.08,
  duration = 20,
}: KenBurnsProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ scale: 1 }}
      animate={inView ? { scale } : { scale: 1 }}
      transition={{
        duration,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
}
