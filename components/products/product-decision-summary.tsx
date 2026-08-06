import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, FlaskConical, HeartPulse, Info } from 'lucide-react';
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
  evidence: 'high' | 'moderate' | 'emerging';
};

const evidenceLabels: Record<string, string> = {
  high: 'High ingredient evidence',
  moderate: 'Moderate ingredient evidence',
  emerging: 'Emerging ingredient evidence',
};

/**
 * Concise decision clarity section — surfaces the key facts a shopper needs
 * without turning the page into a clinical report. Uses progressive disclosure:
 * the full details remain in the ProductQuickPanel "Details" tab.
 */
export function ProductDecisionSummary({
  careStatus,
  careNote,
  concernFit,
  ingredients,
  step,
  category,
  evidence,
}: Props) {
  // Only render when there's something meaningful to show
  const hasContent = careStatus || concernFit.length > 0 || ingredients.length > 0;
  if (!hasContent) return null;

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
            </div>
          ) : null}

          {/* Evidence grade */}
          <div className={styles.cell}>
            <div className={styles.cellHead}>
              <FlaskConical size={15} aria-hidden="true" />
              <span>Evidence</span>
            </div>
            <p className={styles.cellValue}>{evidenceLabels[evidence] ?? 'Emerging evidence'}</p>
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
      </div>
    </section>
  );
}
