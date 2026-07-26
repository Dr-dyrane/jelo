import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { money } from '@/lib/format/money';
import type {
  CommerceSignalView,
  ContributionSignalView,
} from '@/lib/moderation/signals-presentation';
import styles from './signals.module.css';

const countFormatter = new Intl.NumberFormat('en-NG');
const percentFormatter = new Intl.NumberFormat('en-NG', {
  style: 'percent',
  maximumFractionDigits: 0,
});

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${countFormatter.format(count)} ${count === 1 ? singular : plural}`;
}

// A share is never rounded down to 0% while real visits exist, and never up to
// 100% while some visit chose another option.
function shareLabel(share: number) {
  if (share > 0 && share < 0.01) return 'under 1%';
  if (share > 0.99 && share < 1) return 'over 99%';
  return percentFormatter.format(share);
}

function trendLabel(current: number, previous: number) {
  const change = current - previous;
  if (change === 0) return 'Unchanged from the previous 7 days';
  const direction = change > 0 ? 'more than' : 'fewer than';
  return `${countFormatter.format(Math.abs(change))} ${direction} the previous 7 days`;
}

function activityTrend(current: number, previous: number, singular: string) {
  const change = current - previous;
  const noun = Math.abs(change) === 1 ? singular : `${singular}s`;
  if (change === 0) return `${singular[0]?.toUpperCase()}${singular.slice(1)}s unchanged`;
  return `${countFormatter.format(Math.abs(change))} ${change > 0 ? 'more' : 'fewer'} ${noun} than the previous 7 days`;
}

function dateRange(asOf: string, startDaysAgo: number, endDaysAgo: number) {
  const end = new Date(asOf);
  const start = new Date(asOf);
  start.setUTCDate(start.getUTCDate() - startDaysAgo);
  end.setUTCDate(end.getUTCDate() - endDaysAgo);
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
  return (
    <div className={styles.monitor}>
      <section className={styles.summary} aria-labelledby="contributions-heading">
        <div>
          <span className={styles.eyebrow}>Last 7 days</span>
          <h2 id="contributions-heading">Contributions</h2>
          <div className={styles.heroMetrics}>
            <span className={styles.heroMetric}>
              <strong className={styles.total}>{countFormatter.format(contributions.last7DaysCompletions)}</strong>
              <span>completed</span>
            </span>
            <span className={styles.heroMetric}>
              <strong>{countFormatter.format(contributions.last7DaysStarts)}</strong>
              <span>started</span>
            </span>
          </div>
        </div>
        <div className={styles.comparison}>
          <span>{dateRange(contributions.asOf, 7, 0)}</span>
          <strong>
            {activityTrend(
              contributions.last7DaysCompletions,
              contributions.previous7DaysCompletions,
              'completion',
            )}
          </strong>
          <span>
            {activityTrend(
              contributions.last7DaysStarts,
              contributions.previous7DaysStarts,
              'start',
            )}
          </span>
          {contributions.lastCompletedAt ? (
            <span>Last completed <RelativeTime iso={contributions.lastCompletedAt} /></span>
          ) : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sources-heading">
        <header className={styles.sectionHeading}>
          <div>
            <h2 id="sources-heading">How people found us</h2>
            <p>Share skincare starts and completions by source.</p>
          </div>
          <span>{countLabel(contributions.last30DaysCompletions, 'completion')} · last 30 days</span>
        </header>
        {contributions.campaigns.length > 0 ? (
          <ol className={styles.campaignList}>
            {contributions.campaigns.map(campaign => (
              <li key={campaign.key}>
                <span className={styles.campaignCopy}>
                  <strong>{campaign.sourceLabel}</strong>
                  {campaign.detailLabel ? <span>{campaign.detailLabel}</span> : null}
                </span>
                <span className={styles.campaignMeasure}>
                  <strong>{countFormatter.format(campaign.starts)}</strong>
                  <span>started</span>
                </span>
                <span className={styles.campaignMeasure}>
                  <strong>{countFormatter.format(campaign.completions)}</strong>
                  <span>completed</span>
                </span>
                {campaign.lastActivityAt ? <RelativeTime iso={campaign.lastActivityAt} /> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.noData}>No tracked form starts yet.</p>
        )}
      </section>

      <section className={styles.summary} aria-labelledby="store-visits-heading">
        <div>
          <span className={styles.eyebrow}>Last 7 days</span>
          <h2 id="store-visits-heading">Store visits</h2>
          <strong className={styles.total}>{countFormatter.format(commerce.last7DaysCount)}</strong>
        </div>
        <div className={styles.comparison}>
          <span>{dateRange(commerce.asOf, 7, 0)}</span>
          <strong>{trendLabel(commerce.last7DaysCount, commerce.previous7DaysCount)}</strong>
          <span>{countLabel(commerce.previous7DaysCount, 'visit')} in that period</span>
          {commerce.lastRecordedAt ? (
            <span>Last recorded <RelativeTime iso={commerce.lastRecordedAt} /></span>
          ) : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="price-choices-heading">
        <header className={styles.sectionHeading}>
          <div>
            <h2 id="price-choices-heading">Price choices</h2>
            <p>Which presented offer people chose before leaving JeloCare.</p>
          </div>
          <span>{countLabel(commerce.last30DaysCount, 'visit')} · last 30 days</span>
        </header>
        {commerce.last30DaysCount > 0 ? (
          <div className={styles.choiceList}>
            {commerce.priceChoices.map(choice => (
              <div className={styles.choiceRow} key={choice.choice}>
                <div className={styles.choiceCopy}>
                  <span>{choice.label}</span>
                  <span>
                    {countFormatter.format(choice.count)} · {shareLabel(choice.share)}
                  </span>
                </div>
                <progress
                  max={commerce.last30DaysCount}
                  value={choice.count}
                  aria-label={`${choice.label}: ${choice.count} of ${commerce.last30DaysCount} visits`}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noData}>No store visits in the last 30 days.</p>
        )}
      </section>

      <div className={styles.rankedColumns}>
        <section className={styles.section} aria-labelledby="products-heading">
          <header className={styles.sectionHeading}>
            <div>
              <h2 id="products-heading">Most visited products</h2>
              <p>Store visits by product over the last 30 days.</p>
            </div>
          </header>
          {commerce.topProducts.length > 0 ? (
            <ol className={styles.productList}>
              {commerce.topProducts.map((product, index) => (
                <li key={product.slug}>
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.productImage}>
                    {product.image ? (
                      <SafeProductImage src={product.image} alt="" className={styles.productImageAsset} />
                    ) : null}
                  </span>
                  <span className={styles.rankedCopy}>
                    <strong>{product.title}</strong>
                    <span>
                      {product.detail ? `${product.detail} · ` : ''}
                      {countLabel(product.storeCount, 'store')}
                    </span>
                  </span>
                  <span className={styles.rankedValue}>
                    <strong>{countFormatter.format(product.visitCount)}</strong>
                    <span>{product.visitCount === 1 ? 'visit' : 'visits'}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.noData}>No product visits in this period.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="stores-heading">
          <header className={styles.sectionHeading}>
            <div>
              <h2 id="stores-heading">Most visited stores</h2>
              <p>Outbound visits by store over the last 30 days.</p>
            </div>
          </header>
          {commerce.topRetailers.length > 0 ? (
            <ol className={styles.storeList}>
              {commerce.topRetailers.map((retailer, index) => (
                <li key={retailer.retailer}>
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.rankedCopy}>
                    <strong>{retailer.retailer}</strong>
                    <span>{countLabel(retailer.productCount, 'product')}</span>
                  </span>
                  <span className={styles.rankedValue}>
                    <strong>{countFormatter.format(retailer.visitCount)}</strong>
                    <span>{retailer.visitCount === 1 ? 'visit' : 'visits'}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.noData}>No store visits in this period.</p>
          )}
        </section>
      </div>

      <section className={styles.section} aria-labelledby="recent-visits-heading">
        <header className={styles.sectionHeading}>
          <div>
            <h2 id="recent-visits-heading">Recent store visits</h2>
            <p>The latest recorded handoffs from JeloCare to a store.</p>
          </div>
          <span>Latest {commerce.recentVisits.length}</span>
        </header>
        <ol className={styles.recentList}>
          {commerce.recentVisits.map(visit => (
            <li key={visit.id}>
              <span className={styles.recentCopy}>
                <strong>{visit.productTitle}</strong>
                <span>
                  {visit.retailer} · {visit.priceChoiceLabel} · {visit.positionLabel}
                </span>
                <small>
                  {visit.marketLabel}
                  {visit.priceNgn != null ? ` · ${money(visit.priceNgn)}` : ''}
                  {visit.freshnessLabel ? ` · ${visit.freshnessLabel}` : ''}
                </small>
              </span>
              <RelativeTime iso={visit.createdAt} />
            </li>
          ))}
        </ol>
      </section>

      <details className={styles.measureDisclosure}>
        <summary>About these numbers</summary>
        <p>
          A start is recorded after someone answers the first prompt. A completion is a submitted
          contribution. Earlier submissions may not have a source.
        </p>
        <p>
          Store visits are anonymous, read-only measurements from outbound store links.
          Campaign sources are never joined to skincare answers. Neither measure influences
          store ranking, guidance, or safety.
        </p>
      </details>
    </div>
  );
}
