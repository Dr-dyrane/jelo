'use client';

import { useActionState, useEffect, useRef } from 'react';

import type { PendingModerationValue } from '@/lib/moderation/queues';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
import { decideModerationValueAction, mapModerationValueAction } from '../actions';
import styles from '@/components/ops/inbox/inbox.module.css';

interface VocabularyInboxProps {
  rows: PendingModerationValue[];
  canDecide: boolean;
}

export function VocabularyInbox({ rows, canDecide }: VocabularyInboxProps) {
  const [decideState, decideAction, isDecidePending] = useActionState(decideModerationValueAction, null);
  const [mapState, mapAction, isMapPending] = useActionState(mapModerationValueAction, null);
  const pendingDecisionRef = useRef<string | null>(null);
  const inboxControllerRef = useRef<OpsInboxController | null>(null);
  const isPending = isDecidePending || isMapPending;
  const errorState = decideState && !decideState.ok ? decideState : mapState && !mapState.ok ? mapState : null;

  useEffect(() => {
    if (!decideState?.ok) return;
    inboxControllerRef.current?.settleItem(decideState.targetId);
    pendingDecisionRef.current = null;
  }, [decideState]);

  useEffect(() => {
    if (!mapState?.ok) return;
    inboxControllerRef.current?.settleItem(mapState.targetId);
    pendingDecisionRef.current = null;
  }, [mapState]);

  return (
    <InboxContainer
      controllerRef={inboxControllerRef}
      items={rows}
      itemTypeLabel="vocabulary term"
      renderItemRow={(row) => (
        <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
          <div className={styles.subject}>
            <div className={styles.value} style={{ fontSize: '1.05rem' }}>{row.rawValue}</div>
            <div className={styles.metaRow}>
              <StatusPill tone="info">{row.valueKind}</StatusPill>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>×{row.occurrenceCount}</span>
              <RelativeTime iso={row.lastSeenAt} />
            </div>
          </div>
        </div>
      )}
      renderItemDetails={(row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>{row.rawValue}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Normalized</span>
              <code style={{ fontSize: '11px', background: 'var(--ops-surface-subtle)', padding: '2px 6px', borderRadius: 'var(--ops-control-radius)', color: 'var(--ink)', fontWeight: 600 }}>{row.normalizedValue}</code>
            </div>
          </div>

          <div className={styles.propertiesSection} style={{ paddingTop: '12px' }}>
            <div className={styles.propertyRow}><span className={styles.propertyLabel}>Kind</span><span className={styles.propertyValue}><StatusPill tone="info">{row.valueKind}</StatusPill></span></div>
            <div className={styles.propertyRow}><span className={styles.propertyLabel}>Occurrences</span><span className={styles.propertyValue} style={{ fontWeight: 600 }}>{row.occurrenceCount}</span></div>
            <div className={styles.propertyRow}><span className={styles.propertyLabel}>First seen</span><span className={styles.propertyValue}><RelativeTime iso={row.firstSeenAt} /></span></div>
            <div className={styles.propertyRow}><span className={styles.propertyLabel}>Last seen</span><span className={styles.propertyValue}><RelativeTime iso={row.lastSeenAt} /></span></div>
            {row.canonicalEntityKind ? <div className={styles.propertyRow}><span className={styles.propertyLabel}>Canonical kind</span><span className={styles.propertyValue}>{row.canonicalEntityKind}</span></div> : null}
            {row.canonicalEntityRef ? <div className={styles.propertyRow}><span className={styles.propertyLabel}>Canonical reference</span><span className={styles.propertyValue}>{row.canonicalEntityRef}</span></div> : null}
          </div>

          <details className={styles.metadataDisclosure}>
            <summary>Metadata</summary>
            <div className={styles.metadataBody}>
              {row.canonicalEntityRef ? <div className={styles.propertyRow}><span className={styles.propertyLabel}>Canonical reference</span><span className={styles.propertyValue}><IdChip value={row.canonicalEntityRef} label="reference" /></span></div> : null}
              <div className={styles.propertyRow}><span className={styles.propertyLabel}>Vocabulary ID</span><span className={styles.propertyValue}><IdChip value={row.id} label="vocabulary" /></span></div>
            </div>
          </details>

          {canDecide ? (
            <form data-item-id={row.id} className={styles.decideSection} action={decideAction}>
              {errorState && errorState.targetId === row.id ? <div style={{ color: 'var(--state-danger)', fontSize: '11px', background: 'var(--state-danger-bg)', padding: '6px', borderRadius: 'var(--ops-control-radius)' }}>{errorState.error}</div> : null}
              <input type="hidden" name="targetId" value={row.id} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', background: 'var(--ops-surface-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-card)', marginBottom: '8px' }}>
                <strong style={{ fontSize: '11px', color: 'var(--muted)' }}>Canonical mapping target</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: 'var(--muted)' }}>
                    Entity kind
                    <select name="canonicalEntityKind" defaultValue="product" className={styles.note} style={{ minHeight: '34px', resize: 'none' }} disabled={isPending}>
                      <option value="product">Product</option><option value="brand">Brand</option><option value="retailer">Retailer</option><option value="purpose">Purpose</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: 'var(--muted)' }}>
                    Entity reference
                    <input type="text" name="canonicalEntityRef" placeholder="e.g. cerave-hydrating" className={styles.note} style={{ minHeight: '34px' }} disabled={isPending} />
                  </label>
                </div>
              </div>

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
                <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" name="decision" value="map" formAction={mapAction} disabled={isPending} onClick={() => { pendingDecisionRef.current = 'map'; }}>
                  <span>{isPending && pendingDecisionRef.current === 'map' ? 'Mapping…' : 'Map'}</span>
                  <kbd className={styles.kbdBadge}>M</kbd>
                </button>
              </div>
            </form>
          ) : (
            <p style={{ fontSize: '11px', color: 'var(--muted)', paddingTop: '12px', margin: 0 }}>You do not have the required permissions to make decisions on vocabulary.</p>
          )}
        </div>
      )}
    />
  );
}
