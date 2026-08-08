"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect, useRef } from "react";

type CounterProps = {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
};

/**
 * Number count-up animation. Counts from 0 to `value` when the element
 * enters the viewport. Only animates once.
 *
 * - Price counter: pass duration={1.2} for a slow, settling reveal
 * - Store count: pass duration={0.6} for a quick fact
 * - Percentages: pass duration={0.8}
 *
 * Respects prefers-reduced-motion by rendering the final value directly.
 */
export function Counter({
  value,
  duration = 0.8,
  format = (v) => String(Math.round(v)),
  className,
}: CounterProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (latest) => format(latest));

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration, mv]);

  if (reduce) {
    return <span className={className}>{format(value)}</span>;
  }

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
