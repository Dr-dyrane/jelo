import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, FlaskConical, HeartPulse, Info } from 'lucide-react';
import { EvidenceGradeBadge, ClinicalCaution, type EvidenceGradeLevel } from '@/components/clinical/clinical-primitives';
import styles from './product-decision-summary.module.css';

export type DecisionIngredient = {
  id: string;
  label: string;
  sourceUrl?: string;
};

export type DecisionConcern = {
  slug: string;
  name: string;
};

type Props = {
  careStatus: string | null;
  careNote: string;
  concernFit: DecisionConcern[];
  ingredients: DecisionIngredient[];
  step: string;
  category: string;
  evidence: EvidenceGradeLevel;
  /** Care-review approved uses — only present when careState is supportive_eligible */
  approvedUses?: string[];
  /** Evidence source URLs from the care review */
  evidenceSourceUrls?: string[];
  /** When the care review was last reviewed */
  reviewedAt?: string;
};

/**
 * Concise decision clarity section — surfaces the key facts a shopper needs
 * without turning the page into a clinical report. Uses progressive disclosure:
 * the full details remain in the ProductQuickPanel "Details" tab.
 *
 * Clinical content grammar:
 * 1. Plain-language summary (step + category)
 * 2. Why it matters (care review, evidence grade)
 * 3. Practical use (concern fit, key ingredients)
 * 4. Important caution (formula-level caveat)
 */
export function ProductDecisionSummary({
  careStatus,
  careNote,
  concernFit,
  ingredients,
  step,
  category,
  evidence,
  approvedUses,
  evidenceSourceUrls,
  reviewedAt,
}: Props) {
  // Only render when there's something meaningful to show
  const hasContent = careStatus || concernFit.length > 0 || ingredients.length > 0;
  if (!hasContent) return null;

  // "Why JeloCare considers this" is only shown when the care review
  // explicitly approved the product for supportive use
  const hasWhyJeloCare = careStatus === 'Supportive use' && approvedUses && approvedUses.length > 0;

  // The strongest caution is derived from the care review state
  const strongestCaution = careStatus === 'Pharmacist review'
    ? 'Check with a pharmacist before adding this to your routine.'
    : careStatus === 'Formula review pending'
      ? 'This product has not completed formula-level review.'
      : null;

  return (
    <section className={styles.section} aria-labelledby="decision-summary">
      <div className={styles.frame}>
        <p className={styles.eyebrow}>Why JeloCare considers this</p>
        <h2 id="decision-summary" className={styles.heading}>
          {step} · {category}
        </h2>

        <div className={styles.grid}>
          {/* Care review status */}
          {careStatus ? (
            <div className={styles.cell}>
              <div className={styles.cellHead}>
                <HeartPulse size={15} aria-hidden="true" />
                <span>Care review</span>
              </div>
              <p className={styles.cellValue}>{careStatus}</p>
              <p className={styles.cellNote}>{careNote}</p>
              {hasWhyJeloCare ? (
                <p className={styles.cellWhy}>
                  Reviewed for: {approvedUses!.join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Evidence grade */}
          <div className={styles.cell}>
            <div className={styles.cellHead}>
              <FlaskConical size={15} aria-hidden="true" />
              <span>Evidence</span>
            </div>
            <div className={styles.cellBadges}>
              <EvidenceGradeBadge level={evidence} />
            </div>
            <p className={styles.cellNote}>Ingredient-level evidence, not a formula guarantee.</p>
          </div>

          {/* Concern fit */}
          {concernFit.length > 0 ? (
            <div className={styles.cell}>
              <div className={styles.cellHead}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>Good for</span>
              </div>
              <div className={styles.chips}>
                {concernFit.slice(0, 4).map(concern => (
                  <Link
                    key={concern.slug}
                    href={`/concerns/${concern.slug}`}
                    className={styles.chip}
                  >
                    {concern.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Key ingredients */}
          {ingredients.length > 0 ? (
            <div className={styles.cell}>
              <div className={styles.cellHead}>
                <Info size={15} aria-hidden="true" />
                <span>Key ingredients</span>
              </div>
              <div className={styles.chips}>
                {ingredients.slice(0, 5).map(ingredient => ingredient.sourceUrl ? (
                  <a
                    key={ingredient.id}
                    href={ingredient.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.chipLink}
                  >
                    {ingredient.label}
                    <ArrowUpRight size={11} aria-hidden="true" />
                  </a>
                ) : (
                  <span key={ingredient.id} className={styles.chip}>
                    {ingredient.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Important caution — formula-level caveat */}
        {strongestCaution ? (
          <ClinicalCaution label="Important" text={strongestCaution} />
        ) : (
          <p className={styles.formulaCaveat}>
            Evidence describes ingredients, not the complete formula. Patch test new products.
          </p>
        )}

        {/* Evidence sources — only when care review provides them */}
        {evidenceSourceUrls && evidenceSourceUrls.length > 0 ? (
          <div className={styles.evidenceSources}>
            <p className={styles.cellHead}>
              <FlaskConical size={13} aria-hidden="true" />
              <span>Care review sources</span>
            </p>
            <div className={styles.sourceLinks}>
              {evidenceSourceUrls.map(url => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  {sourceHostname(url)} <ArrowUpRight size={11} aria-hidden="true" />
                </a>
              ))}
            </div>
            {reviewedAt ? <p className={styles.reviewedOn}>Care reviewed {formatDate(reviewedAt)}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatDate(date: string): string {
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}
