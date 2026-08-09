"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

type StaggerProps = {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  once?: boolean;
  className?: string;
};

/**
 * Orchestrated group entrance. Wrap a set of <StaggerItem> children
 * in <Stagger> and each item will fade + slide up in sequence when the
 * container enters the viewport.
 *
 * Respects prefers-reduced-motion by rendering children directly.
 *
 * Uses useInView hook instead of whileInView prop for reliable detection
 * on client-side navigation (Next.js Link) where elements mount already
 * in the viewport.
 */
export function Stagger({
  children,
  stagger = 0.06,
  delay = 0,
  once = true,
  className,
}: StaggerProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-60px" });

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  duration?: number;
};

/**
 * Individual item inside a <Stagger>. Inherits the stagger timing from
 * the parent container.
 */
export function StaggerItem({
  children,
  className,
  duration = 0.5,
}: StaggerItemProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease: [0.2, 0.8, 0.2, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
