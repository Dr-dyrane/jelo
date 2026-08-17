"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./care-evidence.module.css";

export type OutcomeSummary = {
  loveIt: number;
  helped: number;
  unsure: number;
  didntHelp: number;
  total: number;
};

export type CareEvidenceProduct = {
  productSlug: string;
  careStateLabel: string | null;
  outcomeSummary: OutcomeSummary;
};

type Tab = "ready" | "monitoring" | "awaiting";

type CareEvidenceViewProps = {
  readyForReview: CareEvidenceProduct[];
  underMonitoring: CareEvidenceProduct[];
  awaitingEvidenceCount: number;
};

const numberFormatter = new Intl.NumberFormat("en-NG");

function outcomeBreakdown(summary: OutcomeSummary): string {
  const parts: string[] = [];
  if (summary.loveIt > 0)
    parts.push(`${numberFormatter.format(summary.loveIt)} love it`);
  if (summary.helped > 0)
    parts.push(`${numberFormatter.format(summary.helped)} helped`);
  if (summary.unsure > 0)
    parts.push(`${numberFormatter.format(summary.unsure)} unsure`);
  if (summary.didntHelp > 0)
    parts.push(`${numberFormatter.format(summary.didntHelp)} didn't help`);
  if (parts.length === 0) return "No outcomes yet";
  return `${parts.join(", ")} · ${numberFormatter.format(summary.total)} total`;
}

function positiveRatio(summary: OutcomeSummary): number | null {
  if (summary.total === 0) return null;
  return (summary.loveIt + summary.helped) / summary.total;
}

function ratioLabel(ratio: number | null): string | null {
  if (ratio === null) return null;
  const percent = new Intl.NumberFormat("en-NG", {
    style: "percent",
    maximumFractionDigits: 0,
  });
  if (ratio > 0 && ratio < 0.01) return "under 1% positive";
  if (ratio > 0.99 && ratio < 1) return "over 99% positive";
  return `${percent.format(ratio)} positive`;
}

export function CareEvidenceView({
  readyForReview,
  underMonitoring,
  awaitingEvidenceCount,
}: CareEvidenceViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>(
    readyForReview.length > 0
      ? "ready"
      : underMonitoring.length > 0
        ? "monitoring"
        : "awaiting",
  );

  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: "ready",
      label: "Ready for pharmacist review",
      count: readyForReview.length,
    },
    {
      id: "monitoring",
      label: "Under monitoring",
      count: underMonitoring.length,
    },
    {
      id: "awaiting",
      label: "Awaiting evidence",
      count: awaitingEvidenceCount,
    },
  ];

  return (
    <div className={styles.surface}>
      <nav className={styles.tabs} aria-label="Care evidence views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span className={styles.tabCount}>
              {numberFormatter.format(tab.count)}
            </span>
          </button>
        ))}
      </nav>

      {activeTab === "ready" && (
        <section className={styles.section} aria-labelledby="ready-heading">
          <header className={styles.sectionHeading}>
            <h2 id="ready-heading">Ready for pharmacist review</h2>
            <span>
              {numberFormatter.format(readyForReview.length)} products
            </span>
          </header>
          {readyForReview.length === 0 ? (
            <p className={styles.empty}>
              No products have accumulated enough community evidence yet.
            </p>
          ) : (
            <ol className={styles.productList}>
              {readyForReview.map((product) => {
                const ratio = positiveRatio(product.outcomeSummary);
                return (
                  <li key={product.productSlug}>
                    <Link
                      href={`/products/${product.productSlug}`}
                      className={styles.productLink}
                    >
                      <span className={styles.productSlug}>
                        {product.productSlug}
                      </span>
                      {product.careStateLabel ? (
                        <span className={styles.careStateLabel}>
                          {product.careStateLabel}
                        </span>
                      ) : null}
                    </Link>
                    <span className={styles.outcomeSummary}>
                      {outcomeBreakdown(product.outcomeSummary)}
                      {(() => {
                        const label = ratioLabel(ratio);
                        return label ? (
                          <span className={styles.ratio}>{label}</span>
                        ) : null;
                      })()}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {activeTab === "monitoring" && (
        <section
          className={styles.section}
          aria-labelledby="monitoring-heading"
        >
          <header className={styles.sectionHeading}>
            <h2 id="monitoring-heading">Under monitoring</h2>
            <span>
              {numberFormatter.format(underMonitoring.length)} products
            </span>
          </header>
          {underMonitoring.length === 0 ? (
            <p className={styles.empty}>
              No products are currently accumulating outcomes.
            </p>
          ) : (
            <ol className={styles.productList}>
              {underMonitoring.map((product) => (
                <li key={product.productSlug}>
                  <Link
                    href={`/products/${product.productSlug}`}
                    className={styles.productLink}
                  >
                    <span className={styles.productSlug}>
                      {product.productSlug}
                    </span>
                  </Link>
                  <span className={styles.outcomeSummary}>
                    {outcomeBreakdown(product.outcomeSummary)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {activeTab === "awaiting" && (
        <section className={styles.section} aria-labelledby="awaiting-heading">
          <header className={styles.sectionHeading}>
            <h2 id="awaiting-heading">Awaiting evidence</h2>
          </header>
          <div className={styles.countCard}>
            <span className={styles.countNumber}>
              {numberFormatter.format(awaitingEvidenceCount)}
            </span>
            <span className={styles.countLabel}>
              {awaitingEvidenceCount === 1
                ? "product has no community outcomes yet"
                : "products have no community outcomes yet"}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
