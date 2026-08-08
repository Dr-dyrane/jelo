"use client";

import { motion, useReducedMotion } from "framer-motion";
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
 */
export function KenBurns({
  children,
  className,
  scale = 1.08,
  duration = 20,
}: KenBurnsProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ scale: 1 }}
      whileInView={{ scale }}
      viewport={{ once: true }}
      transition={{
        duration,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
}
