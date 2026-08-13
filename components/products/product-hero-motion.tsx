"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Stamp } from "@/components/motion/stamp";

type ProductHeroMotionProps = {
  brand: string;
  brandHref: string;
  name: string;
  size: string | null;
  category: string;
  step: string;
  careStatus: string | null;
  priceLabel: string | null;
  lowestPrice: number | null;
  storeCount: number;
  sizeSelector: ReactNode;
  quickPanel: ReactNode;
  basketAction: ReactNode;
  concernLinks: ReactNode;
  image: ReactNode;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

/**
 * Product page hero with motion layer.
 *
 * - Staggered entrance: brand → name → meta → size → care → price → panel → concerns
 * - Market facts render at their final server-owned values; price never animates from a false zero
 * - Care status stamp: scale 1.15 → 0.98 → 1 with warm radial flash
 */
export function ProductHeroMotion({
  brand,
  brandHref,
  name,
  size,
  category,
  step,
  careStatus,
  priceLabel,
  lowestPrice,
  storeCount,
  sizeSelector,
  quickPanel,
  basketAction,
  concernLinks,
  image,
}: ProductHeroMotionProps) {
  const reduce = useReducedMotion();

  return (
    <section className="product-hero">
      <div className="product-visual-large">{image}</div>
      <div className="product-story">
        <motion.div
          className="product-brand-entry"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0 }}
        >
          <Link href={brandHref} aria-label={`View all ${brand} products`}>
            <span className="eyebrow">{brand}</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </motion.div>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.06 }}
        >
          {name}
        </motion.h1>
        <motion.div
          className="product-title-meta"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.12 }}
        >
          {size ? <span>{size}</span> : null}
          <span>{category}</span>
          <span>{step}</span>
        </motion.div>
        {sizeSelector ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.18 }}
          >
            {sizeSelector}
          </motion.div>
        ) : null}
        {careStatus ? (
          <motion.p
            className="product-line"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease, delay: 0.24 }}
          >
            <Stamp delay={0.24}>{careStatus}</Stamp>
          </motion.p>
        ) : null}
        {priceLabel && lowestPrice != null ? (
          <motion.p
            className="product-page-price"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.24 }}
          >
            {priceLabel} · {storeCount} {storeCount === 1 ? "store" : "stores"}
          </motion.p>
        ) : priceLabel ? (
          <motion.p
            className="product-page-price"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.24 }}
          >
            {priceLabel}
          </motion.p>
        ) : null}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.36 }}
        >
          <div className="product-purchase-actions">
            <Fragment key="basket-action">{basketAction}</Fragment>
            <Fragment key="quick-panel">{quickPanel}</Fragment>
          </div>
        </motion.div>
        {concernLinks ? (
          <motion.div
            className="product-concern-links"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.42 }}
          >
            {concernLinks}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
