"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

type Direction = "up" | "left" | "right" | "down";

const offset: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
};

type RevealProps = {
  children: ReactNode;
  direction?: Direction;
  distance?: number;
  delay?: number;
  duration?: number;
  once?: boolean;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span" | "aside";
};

/**
 * Scroll-triggered fade + slide entrance.
 *
 * Wraps any content. When the element enters the viewport (with a -60px
 * margin), it fades in and slides from the given direction. Respects
 * prefers-reduced-motion by rendering children directly.
 *
 * Uses useInView hook instead of whileInView prop for reliable detection
 * on client-side navigation (Next.js Link) where elements mount already
 * in the viewport.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  once = true,
  className,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-60px" });
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const initial = { opacity: 0, ...offset[direction] };

  return (
    <MotionTag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={className}
      initial={initial}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : initial}
      transition={{
        duration,
        delay,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}
