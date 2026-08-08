"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Counter } from "@/components/motion/counter";
import { Stamp } from "@/components/motion/stamp";

type ProductHeroMotionProps = {
  brand: string;
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
  concernLinks: ReactNode;
  image: ReactNode;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

function nairaFormat(value: number) {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

/**
 * Product page hero with motion layer.
 *
 * - Staggered entrance: brand → name → meta → size → care → price → panel → concerns
 * - Price counter: counts up from ₦0 with 1.2s settle ease
 * - Care status stamp: scale 1.15 → 0.98 → 1 with warm radial flash
 */
export function ProductHeroMotion({
  brand,
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
  concernLinks,
  image,
}: ProductHeroMotionProps) {
  const reduce = useReducedMotion();

  return (
    <section className="product-hero">
      <div className="product-visual-large">{image}</div>
      <div className="product-story">
        <motion.p
          className="eyebrow"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0 }}
        >
          {brand}
        </motion.p>
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
            {reduce ? (
              priceLabel
            ) : (
              <>
                {lowestPrice > 0 && (
                  <>
                    From{" "}
                    <Counter
                      value={lowestPrice}
                      duration={1.2}
                      format={nairaFormat}
                    />
                  </>
                )}
                {" · "}
                <Counter
                  value={storeCount}
                  duration={0.6}
                  format={(v) =>
                    `${Math.round(v)} ${Math.round(v) === 1 ? "store" : "stores"}`
                  }
                />
              </>
            )}
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
          {quickPanel}
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
