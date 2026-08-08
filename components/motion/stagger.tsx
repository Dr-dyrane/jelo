"use client";

import { motion, useReducedMotion } from "framer-motion";
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
 */
export function Stagger({
  children,
  stagger = 0.06,
  delay = 0,
  once = true,
  className,
}: StaggerProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-60px" }}
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
