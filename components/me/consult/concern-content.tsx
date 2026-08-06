'use client';

import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import type { Concern } from '@/data/knowledge';
import styles from '../home/me-home.module.css';

export function ConcernContent({
  concern,
  matchedSignals,
  saved,
  onToggle,
  compact = false,
}: {
  concern: Concern;
  matchedTerms?: string[];
  matchedSignals: string[];
  saved: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const isConditionPattern = concern.kind === 'condition-pattern';
  const seeProductsTarget = 'me-consult-products';

  const handleSeeProducts = () => {
    const region = document.getElementById(seeProductsTarget);
    if (region) {
      region.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (compact) {
    return (
      <article className={`${styles.concernContent} ${styles.concernContentCompact}`}>
        <header>
          <p className={styles.concernContentArea}>{concern.area}</p>
          <h3 className={styles.concernContentName}>{concern.name}</h3>
        </header>
        <p className={styles.concernContentSummary}>{concern.summary}</p>
        {isConditionPattern ? (
          <p className={`${styles.concernContentEscalation} ${styles.concernContentEscalationInline}`}>
            <AlertTriangle size={14} aria-hidden="true" /> {concern.escalation}
          </p>
        ) : null}
        <div className={styles.concernContentActions}>
          <button
            type="button"
            className={styles.concernContentSaveButton}
            aria-pressed={saved}
            onClick={onToggle}
          >
            {saved ? <Check size={16} aria-hidden="true" /> : null}
            {saved ? 'Dealing with this' : 'I\u2019m dealing with this'}
          </button>
          {!isConditionPattern ? (
            <button
              type="button"
              className={styles.concernContentSeeProducts}
              onClick={handleSeeProducts}
            >
              See products
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className={styles.concernContent}>
      <header>
        <p className={styles.concernContentArea}>{concern.area}</p>
        <h3 className={styles.concernContentName}>{concern.name}</h3>
      </header>

      <p className={styles.concernContentSummary}>{concern.summary}</p>

      {concern.urgentAction ? (
        <div
          className={styles.concernContentUrgent}
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            {concern.urgentAction.urgency === 'emergency'
              ? 'Emergency: '
              : 'Same-day: '}
            {concern.urgentAction.guidance}
          </p>
        </div>
      ) : null}

      <section className={styles.concernContentSection}>
        <h4 className={styles.concernContentSectionTitle}>What to look for</h4>
        <p className={styles.concernContentList}>
          {concern.signals.map((signal, index) => (
            <span key={signal}>
              {index > 0 ? ' · ' : ''}
              <strong className={matchedSignals.includes(signal) ? styles.concernContentMatched : undefined}>
                {signal}
              </strong>
            </span>
          ))}
        </p>
      </section>

      <section className={styles.concernContentSection}>
        <h4 className={styles.concernContentSectionTitle}>Ingredients that help</h4>
        <ul className={styles.concernContentList}>
          {concern.ingredients.map((ingredient) => {
            const source = concern.ingredientSources?.[ingredient];
            const hasSafetyNote = ingredient.includes('—') || ingredient.includes('do not');
            return (
              <li key={ingredient} className={styles.concernContentIngredient}>
                <span className={hasSafetyNote ? styles.concernContentSafetyNote : undefined}>
                  {ingredient}
                </span>
                {source ? (
                  <a
                    className={styles.concernContentIngredientSource}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    <span className={styles.visuallyHidden}>{source.title}</span>
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${styles.concernContentSection} ${styles.concernContentEscalation}`}>
        <h4 className={styles.concernContentSectionTitle}>
          <AlertTriangle size={15} aria-hidden="true" /> When to get help
        </h4>
        <p>{concern.escalation}</p>
      </section>

      <section className={styles.concernContentSection}>
        <h4 className={styles.concernContentSectionTitle}>Sources</h4>
        <ul className={styles.concernContentSources}>
          {concern.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.concernContentDisclaimer}>
        Educational care context only · Not a diagnosis.
      </p>

      <div className={styles.concernContentActions}>
        <button
          type="button"
          className={styles.concernContentSaveButton}
          aria-pressed={saved}
          onClick={onToggle}
        >
          {saved ? <Check size={16} aria-hidden="true" /> : null}
          {saved ? 'Dealing with this' : 'I\u2019m dealing with this'}
        </button>
        {!isConditionPattern ? (
          <button
            type="button"
            className={styles.concernContentSeeProducts}
            onClick={handleSeeProducts}
          >
            See products
          </button>
        ) : null}
      </div>
    </article>
  );
}
