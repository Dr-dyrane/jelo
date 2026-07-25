import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingRetailerApplications } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
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
  services?: string[] | null;
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
          <InboxContainer
            items={rows}
            itemTypeLabel="retailer application"
            renderItemRow={(row) => (
              <div className={styles.row} style={{ width: '100%', background: 'transparent' }}>
                <div className={styles.subject}>
                  <div className={styles.value} style={{ fontSize: '1.05rem' }}>{row.storeName}</div>
                  <div className={styles.metaRow}>
                    <StatusPill tone={row.emailVerifiedAt ? 'success' : 'danger'}>
                      {row.emailVerifiedAt ? 'verified' : 'unverified'}
                    </StatusPill>
                    <RelativeTime iso={row.submittedAt} />
                  </div>
                </div>
              </div>
            )}
            renderItemDetails={(row) => {
              const p = row.payload as RetailerPayload;
              const channels = Array.isArray(p.channels) ? p.channels.join(', ') : '';
              const brands = Array.isArray(p.brands) ? p.brands.join(', ') : '';
              const services = Array.isArray(p.services) ? p.services.join(', ') : '';

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 var(--space-1)' }}>
                      {row.storeName}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: 0 }}>
                      Primary Email: <strong>{row.email}</strong>
                    </p>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--text-cell)',
                    background: 'var(--tag-bg)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-control)',
                  }}>
                    <div><strong>Store Location:</strong> {p.city || '—'}{p.state?.[0] ? `, ${p.state[0]}` : ''}</div>
                    {p.address ? <div style={{ gridColumn: 'span 2' }}><strong>Full Address:</strong> {p.address}</div> : null}
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
                    {brands ? <div><strong>Brands Stocked:</strong> {brands}</div> : null}
                    {services ? <div><strong>Services:</strong> {services}</div> : null}
                    {p.sampleProduct ? (
                      <div style={{ gridColumn: 'span 2' }}>
                        <strong>Sample Product:</strong> {p.sampleProduct}
                        {p.samplePriceNgn ? ` (₦${p.samplePriceNgn.toLocaleString('en-NG')})` : ''}
                      </div>
                    ) : null}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--text-cell)',
                  }}>
                    <div><strong>Email Status:</strong> {row.emailVerifiedAt ? 'Verified' : 'Unverified'}</div>
                    <div><strong>Submitted:</strong> <RelativeTime iso={row.submittedAt} /></div>
                    <div><strong>Application ID:</strong> <IdChip value={row.id} label="app" /></div>
                  </div>

                  {canDecide ? (
                    <form
                      data-item-id={row.id}
                      className={styles.decide}
                      action={decideRetailerApplicationAction}
                      style={{
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 'var(--space-3)',
                        marginTop: 'var(--space-2)',
                        borderTop: '1px solid rgba(112, 71, 61, 0.08)',
                        paddingTop: 'var(--space-4)',
                      }}
                    >
                      <input type="hidden" name="targetId" value={row.id} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <label htmlFor={`rationale-${row.id}`} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>
                          Decision Rationale
                        </label>
                        <input
                          id={`rationale-${row.id}`}
                          className={styles.note}
                          name="rationale"
                          placeholder="Add explanation..."
                          aria-label="Decision rationale"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">
                          Decline (R)
                        </button>
                        <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">
                          Approve (E)
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 'var(--space-2) 0 0' }}>
                      You do not have the required permissions to make decisions on retailer applications.
                    </p>
                  )}
                </div>
              );
            }}
          />

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
