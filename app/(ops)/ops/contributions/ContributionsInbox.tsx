'use client';

import { useActionState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { PendingContribution } from '@/lib/moderation/queues';
import { money } from '@/lib/format/money';
import { outcomeLabel, outcomeTone } from '@/lib/humanize/outcomes';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
import { decideContributionAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

interface ContributionsInboxProps {
  rows: PendingContribution[];
  canDecide: boolean;
}

type AdaptiveItem = { id: string; label: string; source?: string };

export function parseContributionPayload(payload: Record<string, unknown>) {
  const products = Array.isArray(payload.products) ? (payload.products as AdaptiveItem[]) : [];
  const brands = Array.isArray(payload.brands) ? (payload.brands as AdaptiveItem[]) : [];
  const retailers = Array.isArray(payload.retailers) ? (payload.retailers as AdaptiveItem[]) : [];
  const purposes = Array.isArray(payload.purposes) ? (payload.purposes as AdaptiveItem[]) : [];
  const priceNgn = typeof payload.priceNgn === 'number' ? payload.priceNgn : null;
  const outcome = typeof payload.outcome === 'string' ? payload.outcome : null;
  const purchaseDate = typeof payload.purchaseDate === 'string' ? payload.purchaseDate : null;

  const brandName = brands[0]?.label || '';
  const productName = products.map(p => p.label).join(', ') || '';
  const storeName = retailers.map(r => r.label).join(', ') || '';
  const purposeNames = purposes.map(p => p.label).join(', ') || '';

  let title = 'Community submission';
  if (brandName && productName) {
    if (productName.toLowerCase().startsWith(brandName.toLowerCase())) {
      title = productName;
    } else {
      title = `${brandName} ${productName}`;
    }
  } else if (productName) {
    title = productName;
  } else if (storeName) {
    title = storeName;
  } else if (purposeNames) {
    title = purposeNames;
  }

  return {
    title,
    brandName,
    productName,
    storeName,
    purposeNames,
    priceNgn,
    outcome,
    purchaseDate,
  };
}

export function ContributionsInbox({ rows, canDecide }: ContributionsInboxProps) {
  const [actionState, formAction, isPending] = useActionState(decideContributionAction, null);
  const pendingDecisionRef = useRef<string | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);

  useEffect(() => {
    if (!actionState?.ok) return;
    inboxControllerRef.current?.settleItem(actionState.targetId);
    pendingDecisionRef.current = null;
  }, [actionState]);

  return (
    <InboxContainer
      controllerRef={inboxControllerRef}
      items={rows}
      itemTypeLabel="contribution"
      renderItemRow={(row) => {
        const parsed = parseContributionPayload(row.payload);
        const primaryVal = parsed.priceNgn
          ? money(parsed.priceNgn)
          : parsed.outcome
            ? outcomeLabel(parsed.outcome)
            : parsed.storeName || `${row.kind} intake`;

        return (
          <div className={styles.cardInner}>
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{parsed.title}</div>
              <div className={styles.cardSubtext}>
                {primaryVal} · <RelativeTime iso={row.submittedAt} />
              </div>
            </div>
            <ChevronRight size={16} className={styles.cardCaret} aria-hidden="true" strokeWidth={1.75} />
          </div>
        );
      }}
      renderItemDetails={(row) => {
        const parsed = parseContributionPayload(row.payload);

        return (
          <div className={styles.detailContent}>
            <div className={styles.detailScroll}>
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{parsed.title}</h2>
                <div className={styles.detailMeta}>
                  <StatusPill tone="warning">{row.kind}</StatusPill>
                  <RelativeTime iso={row.submittedAt} />
                </div>
              </div>

              <section className={styles.detailSection}>
                <h3 className={styles.sectionLabel}>Evidence</h3>
                <div className={styles.propertiesSection}>
                  {parsed.brandName ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Brand</span>
                      <span className={styles.propertyValue}>{parsed.brandName}</span>
                    </div>
                  ) : null}
                  {parsed.productName ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Product</span>
                      <span className={styles.propertyValue}>{parsed.productName}</span>
                    </div>
                  ) : null}
                  {parsed.storeName ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Store</span>
                      <span className={styles.propertyValue}>{parsed.storeName}</span>
                    </div>
                  ) : null}
                  {parsed.purposeNames ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Purposes</span>
                      <span className={styles.propertyValue}>{parsed.purposeNames}</span>
                    </div>
                  ) : null}
                  {parsed.priceNgn ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Price</span>
                      <span className={styles.propertyValue}><span className={styles.value}>{money(parsed.priceNgn)}</span></span>
                    </div>
                  ) : null}
                  {parsed.outcome ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Outcome</span>
                      <span className={styles.propertyValue}><StatusPill tone={outcomeTone(parsed.outcome)}>{outcomeLabel(parsed.outcome)}</StatusPill></span>
                    </div>
                  ) : null}
                  {parsed.purchaseDate ? (
                    <div className={styles.propertyRow}>
                      <span className={styles.propertyLabel}>Purchase date</span>
                      <span className={styles.propertyValue}>{parsed.purchaseDate}</span>
                    </div>
                  ) : null}
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyLabel}>Submitted</span>
                    <span className={styles.propertyValue}><RelativeTime iso={row.submittedAt} /></span>
                  </div>
                </div>
              </section>

              <details className={styles.metadataDisclosure}>
                <summary>Raw payload</summary>
                <div className={styles.metadataBody}>
                  <pre style={{ fontSize: '11px', color: 'var(--ink)', background: 'var(--ops-surface-subtle)', border: 0, padding: '10px', borderRadius: 'var(--ops-control-radius)', overflow: 'auto', maxHeight: '240px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </div>
              </details>

              <details className={styles.metadataDisclosure}>
                <summary>Metadata</summary>
                <div className={styles.metadataBody}>
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyLabel}>Retain until</span>
                    <span className={styles.propertyValue}><RelativeTime iso={row.retainUntil} mode="date" /></span>
                  </div>
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyLabel}>Contribution ID</span>
                    <span className={styles.propertyValue}><IdChip value={row.id} label="contribution" /></span>
                  </div>
                </div>
              </details>
            </div>

            {canDecide ? (
              <form data-item-id={row.id} className={styles.decideSection} action={formAction}>
                {actionState && !actionState.ok && actionState.targetId === row.id && (
                  <div style={{ color: 'var(--state-danger)', fontSize: '11px', background: 'var(--state-danger-bg)', padding: '6px', borderRadius: 'var(--ops-control-radius)' }}>{actionState.error}</div>
                )}
                <input type="hidden" name="targetId" value={row.id} />
                <div className={styles.decideField}>
                  <label htmlFor={`rationale-${row.id}`} className={styles.decideNoteLabel}>Rationale</label>
                  <textarea id={`rationale-${row.id}`} className={styles.note} name="rationale" placeholder="Optional note for the audit trail" aria-label="Decision rationale" disabled={isPending} />
                </div>
                <div className={styles.actionButtons}>
                  <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="decision" value="reject" disabled={isPending} onClick={() => { pendingDecisionRef.current = 'reject'; }}>
                    <span>{isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject'}</span>
                    <kbd className={styles.kbdBadge}>R</kbd>
                  </button>
                  <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="approve" disabled={isPending} onClick={() => { pendingDecisionRef.current = 'approve'; }}>
                    <span>{isPending && pendingDecisionRef.current === 'approve' ? 'Approving…' : 'Approve'}</span>
                    <kbd className={styles.kbdBadge}>E</kbd>
                  </button>
                </div>
              </form>
            ) : (
              <p className={styles.permissionNote}>You do not have the required permissions to make decisions on contributions.</p>
            )}
          </div>
        );
      }}
    />
  );
}
