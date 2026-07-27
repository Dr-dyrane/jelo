import { Package } from 'lucide-react';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { OpsRecordVisual } from '@/components/ops/visuals/OpsRecordVisual';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { money } from '@/lib/format/money';
import type {
  CommerceSignalView,
  ContributionSignalView,
} from '@/lib/moderation/signals-presentation';
import styles from './signals.module.css';

const number = new Intl.NumberFormat('en-NG');
const percent = new Intl.NumberFormat('en-NG', {
  style: 'percent',
  maximumFractionDigits: 0,
});

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${number.format(count)} ${count === 1 ? singular : plural}`;
}

// Keep a real non-zero share visible without rounding a partial share to 100%.
function shareLabel(share: number) {
  if (share > 0 && share < 0.01) return 'under 1%';
  if (share > 0.99 && share < 1) return 'over 99%';
  return percent.format(share);
}

function differenceLabel(
  current: number,
  previous: number,
  noun: string,
) {
  const difference = current - previous;
  if (difference === 0) return `Same ${noun} count as the previous 7 days`;
  const measuredNoun = Math.abs(difference) === 1 ? noun : `${noun}s`;
  return `${number.format(Math.abs(difference))} ${difference > 0 ? 'more' : 'fewer'} ${measuredNoun} than the previous 7 days`;
}

function periodLabel(asOf: string, days: number) {
  const end = new Date(asOf);
  const start = new Date(asOf);
  start.setUTCDate(start.getUTCDate() - days);
  const formatter = new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function SignalsMonitor({
  commerce,
  contributions,
}: {
  commerce: CommerceSignalView;
  contributions: ContributionSignalView;
}) {
  const recentHandoffs = commerce.recentVisits.slice(0, 8);

  return (
    <div className={styles.surface}>
      <section
        className={styles.featureRail}
        aria-label="Recent signal summary"
        tabIndex={0}
      >
        <article className={styles.feature}>
          <span className={styles.eyebrow}>Last 7 days</span>
          <h2>Contribution activity</h2>
          <div className={styles.featureMeasures}>
            <span>
              <strong>{number.format(contributions.last7DaysCompletions)}</strong>
              <small>submitted</small>
            </span>
            <span>
              <strong>{number.format(contributions.last7DaysStarts)}</strong>
              <small>started</small>
            </span>
          </div>
          <p>
            {differenceLabel(
              contributions.last7DaysCompletions,
              contributions.previous7DaysCompletions,
              'submission',
            )}
          </p>
          <footer>
            <span>{periodLabel(contributions.asOf, 7)}</span>
            {contributions.lastCompletedAt ? (
              <span>Latest <RelativeTime iso={contributions.lastCompletedAt} /></span>
            ) : (
              <span>No submissions yet</span>
            )}
          </footer>
        </article>

        <article className={styles.feature}>
          <span className={styles.eyebrow}>Last 7 days</span>
          <h2>Store links</h2>
          <div className={styles.featureMeasures}>
            <span>
              <strong>{number.format(commerce.last7DaysCount)}</strong>
              <small>opened</small>
            </span>
          </div>
          <p>
            {differenceLabel(
              commerce.last7DaysCount,
              commerce.previous7DaysCount,
              'open',
            )}
          </p>
          <footer>
            <span>{periodLabel(commerce.asOf, 7)}</span>
            {commerce.lastRecordedAt ? (
              <span>Latest <RelativeTime iso={commerce.lastRecordedAt} /></span>
            ) : (
              <span>No link opened</span>
            )}
          </footer>
        </article>
      </section>

      <section className={styles.section} aria-labelledby="sources-heading">
        <header className={styles.sectionHeading}>
          <h2 id="sources-heading">Leading sources</h2>
          <span>
            Last 30 days · {countLabel(contributions.last30DaysStarts, 'start')} ·{' '}
            {countLabel(contributions.last30DaysCompletions, 'submission')}
          </span>
        </header>
        {contributions.campaigns.length > 0 ? (
          <ol className={styles.sourceList}>
            {contributions.campaigns.map(campaign => (
              <li key={campaign.key}>
                <span className={styles.rowCopy}>
                  <strong>{campaign.sourceLabel}</strong>
                  {campaign.detailLabel ? <span>{campaign.detailLabel}</span> : null}
                </span>
                <span className={styles.rowMeasure}>
                  <strong>{number.format(campaign.starts)}</strong>
                  <small>started</small>
                </span>
                <span className={styles.rowMeasure}>
                  <strong>{number.format(campaign.completions)}</strong>
                  <small>submitted</small>
                </span>
                {campaign.lastActivityAt ? (
                  <RelativeTime iso={campaign.lastActivityAt} />
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No contribution activity in the last 30 days.</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="position-heading">
        <header className={styles.sectionHeading}>
          <h2 id="position-heading">Price choices</h2>
          <span>
            Last 30 days · {countLabel(commerce.last30DaysCount, 'open')}
          </span>
        </header>
        {commerce.last30DaysCount > 0 ? (
          <div className={styles.positionGrid}>
            {commerce.priceChoices.map(choice => (
              <div className={styles.position} key={choice.choice}>
                <span className={styles.positionCopy}>
                  <span>{choice.label}</span>
                  <strong>
                    {number.format(choice.count)} · {shareLabel(choice.share)}
                  </strong>
                </span>
                <progress
                  max={commerce.last30DaysCount}
                  value={choice.count}
                  aria-label={`${choice.label}: ${choice.count} of ${commerce.last30DaysCount} store-link opens`}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No store links opened in the last 30 days.</p>
        )}
      </section>

      <div className={styles.rankedColumns}>
        <section className={styles.section} aria-labelledby="products-heading">
          <header className={styles.sectionHeading}>
            <h2 id="products-heading">Most-opened products</h2>
            <span>Last 30 days</span>
          </header>
          {commerce.topProducts.length > 0 ? (
            <ol className={styles.productList}>
              {commerce.topProducts.map(product => (
                <li key={product.slug}>
                  <span className={styles.productStage}>
                    {product.image ? (
                      <SafeProductImage
                        src={product.image}
                        alt=""
                        className={styles.productImage}
                      />
                    ) : null}
                  </span>
                  <span className={styles.rowCopy}>
                    <strong>{product.title}</strong>
                    <span>
                      {product.detail ? `${product.detail} · ` : ''}
                      {countLabel(product.storeCount, 'store')}
                    </span>
                  </span>
                  <span className={styles.rowMeasure}>
                    <strong>{number.format(product.visitCount)}</strong>
                    <small>{product.visitCount === 1 ? 'open' : 'opens'}</small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No product links opened in this period.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="stores-heading">
          <header className={styles.sectionHeading}>
            <h2 id="stores-heading">Most-opened stores</h2>
            <span>Last 30 days</span>
          </header>
          {commerce.topRetailers.length > 0 ? (
            <ol className={styles.storeList}>
              {commerce.topRetailers.map(retailer => (
                <li key={retailer.retailer}>
                  <span className={styles.rowCopy}>
                    <strong>{retailer.retailer}</strong>
                    <span>{countLabel(retailer.productCount, 'product')}</span>
                  </span>
                  <span className={styles.rowMeasure}>
                    <strong>{number.format(retailer.visitCount)}</strong>
                    <small>{retailer.visitCount === 1 ? 'open' : 'opens'}</small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No store links opened in this period.</p>
          )}
        </section>
      </div>

      <section className={styles.section} aria-labelledby="recent-heading">
        <header className={styles.sectionHeading}>
          <h2 id="recent-heading">Recent store links</h2>
          <span>Latest {recentHandoffs.length}</span>
        </header>
        {recentHandoffs.length > 0 ? (
          <ol className={styles.recentList}>
            {recentHandoffs.map(handoff => (
              <li key={handoff.id}>
                <OpsRecordVisual
                  image={handoff.image}
                  className={styles.productStage}
                  imageClassName={styles.productImage}
                  fallback={<Package size={19} strokeWidth={1.65} />}
                />
                <span className={styles.rowCopy}>
                  <strong>{handoff.productTitle}</strong>
                  <span>
                    {handoff.retailer} · {handoff.priceChoiceLabel} · {handoff.positionLabel}
                  </span>
                  <small>
                    {handoff.marketLabel}
                    {handoff.priceNgn != null ? ` · ${money(handoff.priceNgn)}` : ''}
                    {handoff.freshnessLabel ? ` · ${handoff.freshnessLabel}` : ''}
                  </small>
                </span>
                <RelativeTime iso={handoff.createdAt} />
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No store links opened yet.</p>
        )}
      </section>

      <footer className={styles.boundary}>
        <p>
          Starts follow the first answer. Submitted means the note reached
          JeloCare. Earlier notes may not include a source.
        </p>
        <p>
          Store-link opens are anonymous. Sources are never joined to skincare
          answers or used to change store order, guidance, or safety.
        </p>
      </footer>
    </div>
  );
}
