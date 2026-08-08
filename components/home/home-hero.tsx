"use client";

import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef } from "react";
import { MorningLightCanvas } from "@/components/motion/morning-light-canvas";

type HomeHeroProps = {
  heroImageUrl: string;
  heroCategories: string[];
  classes: {
    hero: string;
    heroShade: string;
    heroCopy: string;
    heroKicker: string;
    heroDeck: string;
    actions: string;
    primary: string;
    secondary: string;
    glassCard: string;
    glassFeature: string;
    heroMeta: string;
  };
};

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Homepage hero with motion layer.
 *
 * - WebGL morning light canvas behind content (progressive enhancement)
 * - Staggered entrance for kicker, h1, deck, action buttons
 * - Glass card slides from right with parallax depth
 * - Scroll-away: content moves up slightly faster than scroll,
 *   morning light fades out
 */
export function HomeHero({
  heroImageUrl,
  heroCategories,
  classes,
}: HomeHeroProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Scroll-away transforms
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const glassY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const glassY2 = useTransform(scrollYProgress, [0, 1], [0, -20]);
  const lightOpacity = useTransform(scrollYProgress, [0, 0.6], [0.5, 0]);

  return (
    <section
      ref={ref}
      className={classes.hero}
      style={{
        backgroundImage: `url("${heroImageUrl}")`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* WebGL morning light — sits above background image, below shade */}
      {!reduce && (
        <motion.div
          style={{
            opacity: lightOpacity,
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}
        >
          <MorningLightCanvas opacity={0.5} />
        </motion.div>
      )}

      {/* Shade overlay — above canvas, below copy */}
      <div
        className={classes.heroShade}
        style={{ position: "absolute", inset: 0, zIndex: 2 }}
      />

      {/* Hero copy — staggered entrance + scroll parallax */}
      <motion.div
        className={classes.heroCopy}
        style={
          reduce ? undefined : { y: copyY, position: "relative", zIndex: 3 }
        }
      >
        <motion.p
          className={classes.heroKicker}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0 }}
        >
          JeloCare
        </motion.p>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.08 }}
        >
          Skin, beautifully understood.
        </motion.h1>
        <motion.p
          className={classes.heroDeck}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.16 }}
        >
          Products. Prices. Clear context.
        </motion.p>
        <motion.div
          className={classes.actions}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.24 }}
        >
          <Link className={classes.primary} href="/products">
            Browse products
          </Link>
          <Link className={classes.secondary} href="/consult">
            Ask JeloCare
          </Link>
        </motion.div>
      </motion.div>

      {/* Glass feature card — slides from right + parallax depth */}
      <motion.div
        className={`${classes.glassCard} ${classes.glassFeature}`}
        initial={reduce ? false : { opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease, delay: 0.4 }}
        style={
          reduce ? undefined : { y: glassY, position: "absolute", zIndex: 4 }
        }
      >
        <span>JeloCare</span>
        <strong>For every skin.</strong>
        <small>Clear context</small>
      </motion.div>

      {/* Category meta pills */}
      <motion.div
        className={classes.heroMeta}
        initial={reduce ? false : { opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease, delay: 0.52 }}
        style={
          reduce ? undefined : { y: glassY2, position: "absolute", zIndex: 4 }
        }
      >
        {heroCategories.map((category) => (
          <span key={category}>{category}</span>
        ))}
      </motion.div>
    </section>
  );
}
