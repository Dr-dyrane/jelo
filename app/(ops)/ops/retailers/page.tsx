import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingRetailerApplications } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { decideRetailerApplicationAction } from '../actions';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

type RetailerPayload = {
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  instagram?: string | null;
  city?: string | null;
  state?: string[] | null;
  address?: string | null;
  channels?: string[] | null;
  brands?: string[] | null;
  sampleProduct?: string | null;
  samplePriceNgn?: number | null;
};

export default async function RetailerApplicationsQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'retailers.decide');
  const rows = await listPendingRetailerApplications(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Retailer applications</h1>
      <p className={opsStyles.lede}>Submitted partnership applications. Approval feeds the existing verification lane (ADR 0003); it does not publish a retailer.</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending applications"
          body="New retailer partnership applications will appear here when submitted."
        />
      ) : (
        <>
          <div className={styles.card}>
            {rows.map(row => {
              const p = row.payload as RetailerPayload;
              const channels = Array.isArray(p.channels) ? p.channels.join(', ') : '';
              const brands = Array.isArray(p.brands) ? p.brands.join(', ') : '';

              return (
                <div key={row.id} className={styles.row}>
                  <div className={styles.subject}>
                    <div className={styles.value} style={{ fontSize: '1.15rem' }}>{row.storeName}</div>
                    <div className={styles.metaRow}>
                      <span style={{ fontSize: 'var(--text-cell)', color: 'var(--ink)' }}>{row.email}</span>
                      <StatusPill tone={row.emailVerifiedAt ? 'success' : 'danger'}>
                        {row.emailVerifiedAt ? 'email verified' : 'unverified'}
                      </StatusPill>
                      <RelativeTime iso={row.submittedAt} />
                      <IdChip value={row.id} label="app" />
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-cell)',
                      color: 'var(--muted)',
                      background: 'var(--tag-bg)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-control)',
                      marginTop: 'var(--space-2)',
                    }}>
                      <div><strong>Location:</strong> {p.city || '—'}{p.state?.[0] ? `, ${p.state[0]}` : ''}</div>
                      <div><strong>Phone:</strong> {p.phone || '—'}</div>
                      <div><strong>WhatsApp:</strong> {p.whatsapp || '—'}</div>
                      {p.website ? (
                        <div>
                          <strong>Website:</strong>{' '}
                          <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
                            {p.website}
                          </a>
                        </div>
                      ) : null}
                      {p.instagram ? <div><strong>Instagram:</strong> {p.instagram}</div> : null}
                      {channels ? <div><strong>Channels:</strong> {channels}</div> : null}
                      {brands ? <div><strong>Brands:</strong> {brands}</div> : null}
                      {p.sampleProduct ? (
                        <div>
                          <strong>Sample Product:</strong> {p.sampleProduct}
                          {p.samplePriceNgn ? ` (₦${p.samplePriceNgn.toLocaleString('en-NG')})` : ''}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {canDecide ? (
                    <form className={styles.decide} action={decideRetailerApplicationAction}>
                      <input type="hidden" name="targetId" value={row.id} />
                      <input className={styles.note} name="rationale" placeholder="Note" aria-label="Decision note" />
                      <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">Approve</button>
                      <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">Decline</button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
