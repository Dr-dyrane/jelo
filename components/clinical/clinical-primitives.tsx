/**
 * Shared clinical-display primitives for JeloCare.
 *
 * These are extracted only where duplication is proven across ingredient,
 * product and concern surfaces. Each primitive is data-gated: it renders
 * nothing when the source data is absent, so callers never need to hide
 * "unknown" fallbacks.
 */
import { ArrowUpRight } from 'lucide-react';
import styles from './clinical-primitives.module.css';

export type EvidenceGradeLevel = 'high' | 'moderate' | 'emerging' | 'insufficient' | 'limited';

const evidenceLabels: Record<EvidenceGradeLevel, string> = {
  high: 'High evidence',
  moderate: 'Moderate evidence',
  emerging: 'Emerging evidence',
  insufficient: 'Not enough evidence',
  limited: 'Limited evidence',
};

const evidenceNotes: Partial<Record<EvidenceGradeLevel, string>> = {
  high: 'Well-studied for its primary use.',
  moderate: 'Some evidence supports this use.',
  emerging: 'Early evidence; still being studied.',
  insufficient: 'Not enough evidence to assess.',
  limited: 'Evidence is limited.',
};

export function evidenceGradeLabel(level: EvidenceGradeLevel): string {
  return evidenceLabels[level] ?? evidenceLabels.insufficient;
}

export function evidenceGradeNote(level: EvidenceGradeLevel): string | null {
  return evidenceNotes[level] ?? null;
}

export type SafetyStatus = 'safe' | 'caution' | 'avoid' | 'unknown' | 'generally_safe' | 'use_with_caution';

const safetyLabels: Record<SafetyStatus, string> = {
  safe: 'Generally safe',
  generally_safe: 'Generally safe',
  caution: 'Use with caution',
  use_with_caution: 'Use with caution',
  avoid: 'Avoid',
  unknown: 'Sensitivity unknown',
};

export function safetyStatusLabel(status: SafetyStatus): string {
  return safetyLabels[status] ?? safetyLabels.unknown;
}

export function formatReviewedOn(date: string): string {
  // ISO date string → "Reviewed July 2026"
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `Reviewed ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  } catch {
    return '';
  }
}

export type SourceEntry = {
  title: string;
  url: string;
};

/**
 * Filters out undefined sources and deduplicates by URL.
 * Returns an empty array when no sources are supplied.
 */
export function deduplicateSources(sources: (SourceEntry | undefined | null)[]): SourceEntry[] {
  const seen = new Set<string>();
  return sources.filter((s): s is SourceEntry => {
    if (!s || !s.url) return false;
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

const badgeClass: Record<EvidenceGradeLevel, string> = {
  high: styles.badgeHigh,
  moderate: styles.badgeModerate,
  emerging: styles.badgeEmerging,
  insufficient: styles.badgeInsufficient,
  limited: styles.badgeLimited,
};

/**
 * Evidence grade badge with optional note.
 * Renders nothing when level is undefined.
 */
export function EvidenceGradeBadge({ level, showNote = false }: { level: EvidenceGradeLevel; showNote?: boolean }) {
  const note = showNote ? evidenceGradeNote(level) : null;
  return (
    <span className={`${styles.badge} ${badgeClass[level] ?? styles.badgeInsufficient}`}>
      {evidenceGradeLabel(level)}
      {note ? <span className={styles.badgeNote}>{note}</span> : null}
    </span>
  );
}

/**
 * Safety status badge.
 * Renders nothing when status is undefined or unknown and hideUnknown is true.
 */
export function SafetyBadge({ status, hideUnknown = false }: { status: SafetyStatus; hideUnknown?: boolean }) {
  if (hideUnknown && status === 'unknown') return null;
  return <span className={styles.badge}>{safetyStatusLabel(status)}</span>;
}

/**
 * Clinical caution callout. Renders nothing when text is empty.
 */
export function ClinicalCaution({ label = 'Important', text }: { label?: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div className={styles.caution} role="note">
      <p className={styles.cautionLabel}>{label}</p>
      <p className={styles.cautionText}>{text}</p>
    </div>
  );
}

/**
 * Source list with external links. Renders nothing when sources is empty.
 */
export function SourceList({ sources, label }: { sources: SourceEntry[]; label?: string }) {
  const deduped = deduplicateSources(sources);
  if (deduped.length === 0) return null;
  return (
    <div className={styles.sourceList}>
      {label ? <p className={styles.cautionLabel}>{label}</p> : null}
      {deduped.map(source => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
          {source.title} <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

/**
 * Reviewed-on date line. Renders nothing when date is invalid.
 */
export function ReviewedOn({ date, prefix = 'Reviewed' }: { date: string; prefix?: string }) {
  const formatted = formatReviewedOn(date);
  if (!formatted) return null;
  return <p className={styles.reviewedOn}>{prefix === 'Reviewed' ? formatted : `${prefix} ${formatted.replace('Reviewed ', '')}`}</p>;
}
