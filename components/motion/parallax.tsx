"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

type ParallaxProps = {
  children: ReactNode;
  range?: [number, number];
  axis?: "y" | "x";
  className?: string;
};

/**
 * Scroll-linked depth. Translates the element based on its position in
 * the viewport as the user scrolls. Subtle by default (±20px for
 * backgrounds, ±8px for foregrounds — pass a smaller range).
 *
 * Respects prefers-reduced-motion by rendering children without motion.
 */
export function Parallax({
  children,
  range = [-20, 20],
  axis = "y",
  className,
}: ParallaxProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const value = useTransform(scrollYProgress, [0, 1], range);

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={axis === "y" ? { y: value } : { x: value }}
    >
      {children}
    </motion.div>
  );
}
