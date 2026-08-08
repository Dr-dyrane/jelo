"use client";

import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

type BreathingButtonProps = {
  children: ReactNode;
  href: string;
  className?: string;
};

/**
 * Breathing scale animation for CTAs. The element gently scales between
 * 1.0 and 1.02 on a 4-second loop — a breath, not a pulse. The effect
 * pauses when the element is out of viewport.
 *
 * Respects prefers-reduced-motion by rendering a plain link.
 */
export function BreathingButton({
  children,
  href,
  className,
}: BreathingButtonProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const inView = useInView(ref, { margin: "-40px" });

  if (reduce) {
    return (
      <a ref={ref} href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      animate={
        inView
          ? {
              scale: [1, 1.02, 1],
            }
          : { scale: 1 }
      }
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.a>
  );
}
