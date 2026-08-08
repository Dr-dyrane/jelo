"use client";

import {
  motion,
  useReducedMotion,
  useInView,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { useRef, type MouseEvent } from "react";
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
 * Also adds magnetic hover — the button drifts toward the cursor by up
 * to 6px, settling back on mouse leave.
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

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 15 });
  const sy = useSpring(my, { stiffness: 200, damping: 15 });

  function handleMove(e: MouseEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(px * 12);
    my.set(py * 12);
  }

  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

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
      style={{ x: sx, y: sy }}
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
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </motion.a>
  );
}
