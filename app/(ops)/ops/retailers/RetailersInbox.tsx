'use client';

import { useActionState, useEffect, useRef } from 'react';

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
  const [actionState, formAction, isPending] = useActionState(decideRetailerApplicationAction, null);
  const pendingDecisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (actionState?.ok && window.__opsInboxAdvance) {
      window.__opsInboxAdvance(actionState.targetId);
      pendingDecisionRef.current = null;
    }
  }, [actionState]);

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

        // Formulate direct verification links
        const cleanPhone = p.phone ? p.phone.replace(/[^0-9+]/g, '') : '';
        const cleanWhatsApp = p.whatsapp ? p.whatsapp.replace(/[^0-9]/g, '') : '';
        const cleanInstagram = p.instagram ? p.instagram.replace('@', '').trim() : '';

        const whatsappUrl = cleanWhatsApp ? `https://wa.me/${cleanWhatsApp}` : null;
        const instagramUrl = cleanInstagram ? `https://instagram.com/${cleanInstagram}` : null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px' }}>
                {row.storeName}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                Primary Email: <a href={`mailto:${row.email}`} style={{ color: 'var(--wine)', textDecoration: 'underline' }}>{row.email}</a>
              </p>
            </div>

            {/* Properties Grid */}
            <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
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
                  <span style={{ fontSize: '11px', whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--ink)' }}>
                    {p.address}
                  </span>
                </div>
              ) : null}
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Phone</span>
                <span className={styles.propertyValue}>
                  {cleanPhone ? (
                    <a href={`tel:${cleanPhone}`} style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
                      {p.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>WhatsApp</span>
                <span className={styles.propertyValue}>
                  {whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
                      {p.whatsapp}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              {p.website ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Website</span>
                  <span className={styles.propertyValue}>
                    <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
                      {p.website}
                    </a>
                  </span>
                </div>
              ) : null}
              {p.instagram ? (
                <div className={styles.propertyRow}>
                  <span className={styles.propertyLabel}>Instagram</span>
                  <span className={styles.propertyValue}>
                    {instagramUrl ? (
                      <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
                        @{cleanInstagram}
                      </a>
                    ) : (
                      p.instagram
                    )}
                  </span>
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
                  <span style={{ fontSize: '11px', whiteSpace: 'normal', color: 'var(--ink)' }}>
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
                action={formAction}
              >
                {actionState && !actionState.ok && actionState.targetId === row.id && (
                  <div style={{ color: 'var(--red)', fontSize: '11px', background: 'var(--red-light)', padding: '6px', borderRadius: '4px' }}>
                    {actionState.error}
                  </div>
                )}
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
                    disabled={isPending}
                  />
                </div>
                <div className={styles.actionButtons}>
                  <button
                    className={`${styles.btn} ${styles.btnReject}`}
                    type="submit"
                    name="decision"
                    value="reject"
                    disabled={isPending}
                    onClick={() => { pendingDecisionRef.current = 'reject'; }}
                  >
                    {isPending && pendingDecisionRef.current === 'reject' ? 'Declining…' : 'Decline (R)'}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnApprove}`}
                    type="submit"
                    name="decision"
                    value="approve"
                    disabled={isPending}
                    onClick={() => { pendingDecisionRef.current = 'approve'; }}
                  >
                    {isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve (E)'}
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '12px', margin: 0 }}>
                You do not have the required permissions to make decisions on retailer applications.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
