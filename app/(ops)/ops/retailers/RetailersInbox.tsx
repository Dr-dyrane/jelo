'use client';

import type { PendingRetailerApplication } from '@/lib/moderation/queues';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import { decideRetailerApplicationAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

interface RetailersInboxProps {
  rows: PendingRetailerApplication[];
  canDecide: boolean;
}

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

export function RetailersInbox({ rows, canDecide }: RetailersInboxProps) {
  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="retailer application"
      renderItemRow={(row) => (
        <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-text)', margin: '0 0 2px' }}>
                {row.storeName}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--linear-text-muted)', margin: 0 }}>
                Primary Email: <strong>{row.email}</strong>
              </p>
            </div>

            {/* Properties Grid */}
            <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--linear-border)', paddingTop: '12px' }}>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Email Status</span>
                <span className={styles.propertyValue}>
                  <StatusPill tone={row.emailVerifiedAt ? 'success' : 'danger'}>
                    {row.emailVerifiedAt ? 'Verified' : 'Unverified'}
                  </StatusPill>
                </span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Location</span>
                <span className={styles.propertyValue} title={`${p.city || ''}, ${p.state?.[0] || ''}`}>
                  {p.city || '—'}{p.state?.[0] ? `, ${p.state[0]}` : ''}
                </span>
              </div>
              {p.address ? (
                <div className={styles.propertyRow} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.propertyLabel}>Address</span>
                  <span style={{ fontSize: '11px', whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--linear-text)' }}>
                    {p.address}
                  </span>
                </div>
              ) : null}
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Phone</span>
                <span className={styles.propertyValue}>{p.phone || '—'}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>WhatsApp</span>
                <span className={styles.propertyValue}>{p.whatsapp || '—'}</span>
              </div>
              {p.website ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Website</span>
                  <span className={styles.propertyValue}>
                    <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--linear-accent)', textDecoration: 'underline' }}>
                      {p.website}
                    </a>
                  </span>
                </div>
              ) : null}
              {p.instagram ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Instagram</span>
                  <span className={styles.propertyValue}>{p.instagram}</span>
                </div>
              ) : null}
              {channels ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Channels</span>
                  <span className={styles.propertyValue} title={channels}>{channels}</span>
                </div>
              ) : null}
              {brands ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Brands</span>
                  <span className={styles.propertyValue} title={brands}>{brands}</span>
                </div>
              ) : null}
              {services ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Services</span>
                  <span className={styles.propertyValue} title={services}>{services}</span>
                </div>
              ) : null}
              {p.sampleProduct ? (
                <div className={styles.propertyRow} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.propertyLabel}>Sample</span>
                  <span style={{ fontSize: '11px', whiteSpace: 'normal', color: 'var(--linear-text)' }}>
                    {p.sampleProduct} {p.samplePriceNgn ? `(₦${p.samplePriceNgn.toLocaleString('en-NG')})` : ''}
                  </span>
                </div>
              ) : null}
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Submitted</span>
                <span className={styles.propertyValue}><RelativeTime iso={row.submittedAt} /></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>App ID</span>
                <span className={styles.propertyValue}><IdChip value={row.id} label="app" /></span>
              </div>
            </div>

            {/* Decision form */}
            {canDecide ? (
              <form
                data-item-id={row.id}
                className={styles.decideSection}
                action={decideRetailerApplicationAction}
              >
                <input type="hidden" name="targetId" value={row.id} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>
                    Decision Rationale
                  </label>
                  <textarea
                    id={`rationale-${row.id}`}
                    className={styles.note}
                    name="rationale"
                    placeholder="Add explanation (optional)..."
                    aria-label="Decision rationale"
                  />
                </div>
                <div className={styles.actionButtons}>
                  <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject">
                    Decline (R)
                  </button>
                  <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve">
                    Approve (E)
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--linear-text-muted)', borderTop: '1px solid var(--linear-border)', paddingTop: '12px', margin: 0 }}>
                You do not have the required permissions to make decisions on retailer applications.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
