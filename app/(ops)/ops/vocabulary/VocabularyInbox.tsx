'use client';

import { useActionState, useEffect, useRef } from 'react';

import type { PendingModerationValue } from '@/lib/moderation/queues';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
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
  const isPending = isDecidePending || isMapPending;
  const errorState = (decideState && !decideState.ok) ? decideState : ((mapState && !mapState.ok) ? mapState : null);

  useEffect(() => {
    if (decideState?.ok && window.__opsInboxAdvance) {
      window.__opsInboxAdvance(decideState.targetId);
      pendingDecisionRef.current = null;
    }
  }, [decideState]);

  useEffect(() => {
    if (mapState?.ok && window.__opsInboxAdvance) {
      window.__opsInboxAdvance(mapState.targetId);
      pendingDecisionRef.current = null;
    }
  }, [mapState]);

  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="vocabulary term"
      renderItemRow={(row) => (
        <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
          <div className={styles.subject}>
            <div className={styles.value} style={{ fontSize: '1.05rem' }}>{row.rawValue}</div>
            <div className={styles.metaRow}>
              <StatusPill tone="info">{row.valueKind}</StatusPill>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                ×{row.occurrenceCount}
              </span>
              <RelativeTime iso={row.lastSeenAt} />
            </div>
          </div>
        </div>
      )}
      renderItemDetails={(row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>
              {row.rawValue}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Normalized:</span>
              <code style={{
                fontSize: '11px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                padding: '2px 6px',
                borderRadius: '4px',
                color: 'var(--ink)',
                fontWeight: 600
              }}>
                {row.normalizedValue}
              </code>
            </div>
          </div>

          {/* Properties Grid */}
          <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Kind</span>
              <span className={styles.propertyValue}><StatusPill tone="info">{row.valueKind}</StatusPill></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Occurrences</span>
              <span className={styles.propertyValue} style={{ fontWeight: 600 }}>{row.occurrenceCount}</span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>First Seen</span>
              <span className={styles.propertyValue}><RelativeTime iso={row.firstSeenAt} /></span>
            </div>
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Last Seen</span>
              <span className={styles.propertyValue}><RelativeTime iso={row.lastSeenAt} /></span>
            </div>
            {row.canonicalEntityKind ? (
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Canonical Kind</span>
                <span className={styles.propertyValue}>{row.canonicalEntityKind}</span>
              </div>
            ) : null}
            {row.canonicalEntityRef ? (
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Canonical Ref</span>
                <span className={styles.propertyValue}><IdChip value={row.canonicalEntityRef} label="ref" /></span>
              </div>
            ) : null}
            <div className={styles.propertyRow}>
              <span className={styles.propertyLabel}>Vocab ID</span>
              <span className={styles.propertyValue}><IdChip value={row.id} label="vocab" /></span>
            </div>
          </div>

          {/* Decision Form & Mapping Inputs */}
          {canDecide ? (
            <form
              data-item-id={row.id}
              className={styles.decideSection}
              action={decideAction}
            >
              {errorState && errorState.targetId === row.id && (
                <div style={{ color: 'var(--red)', fontSize: '11px', background: 'var(--red-light)', padding: '6px', borderRadius: '4px' }}>
                  {errorState.error}
                </div>
              )}
              <input type="hidden" name="targetId" value={row.id} />
              
              {/* Canonical Mapping Inputs */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                background: 'var(--card)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--elevation-1)',
                marginBottom: '8px'
              }}>
                <strong style={{ fontSize: '11px', color: 'var(--muted)' }}>Canonical Mapping Target</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--muted)' }}>Entity Kind</label>
                    <select
                      name="canonicalEntityKind"
                      defaultValue="product"
                      style={{
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-control)',
                        border: '1px solid var(--border)',
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        fontSize: '11.5px',
                        outline: 'none'
                      }}
                      disabled={isPending}
                    >
                      <option value="product">Product</option>
                      <option value="brand">Brand</option>
                      <option value="retailer">Retailer</option>
                      <option value="purpose">Purpose</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--muted)' }}>Entity Ref / Slug</label>
                    <input
                      type="text"
                      name="canonicalEntityRef"
                      placeholder="e.g. cerave-hydrating"
                      style={{
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-control)',
                        border: '1px solid var(--border)',
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        fontSize: '11.5px',
                        outline: 'none'
                      }}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>

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
                  {isPending && pendingDecisionRef.current === 'reject' ? 'Rejecting…' : 'Reject (R)'}
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
                <button
                  className={styles.btn}
                  type="submit"
                  name="decision"
                  value="map"
                  formAction={mapAction}
                  style={{ background: 'var(--wine)', color: 'var(--paper)', borderColor: 'var(--wine)' }}
                  disabled={isPending}
                  onClick={() => { pendingDecisionRef.current = 'map'; }}
                >
                  {isPending && pendingDecisionRef.current === 'map' ? 'Mapping…' : 'Map (M)'}
                </button>
              </div>
            </form>
          ) : (
            <p style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '12px', margin: 0 }}>
              You do not have the required permissions to make decisions on vocabulary.
            </p>
          )}
        </div>
      )}
    />
  );
}
