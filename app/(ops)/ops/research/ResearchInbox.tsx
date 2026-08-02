'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Microscope } from 'lucide-react';
import type { PendingResearchTask } from '@/lib/moderation/research-tasks';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer, type OpsInboxController } from '@/components/ops/inbox/InboxContainer';
import { useUrlInboxSelection } from '@/components/ops/inbox/use-url-inbox-selection';
import { assignResearchTaskAction, resolveResearchTaskAction } from './actions';
import styles from '@/components/ops/inbox/inbox.module.css';
import researchStyles from './research.module.css';

function taskLabel(kind: PendingResearchTask['taskKind']) {
  if (kind === 'product-identity') return 'Product identity';
  if (kind === 'product-retail-refresh') return 'Product availability';
  if (kind === 'retailer-identity') return 'Store identity';
  return 'Store refresh';
}

function outcomes(row: PendingResearchTask) {
  return row.entityKind === 'product'
    ? [
        ['existing-canonical-product', 'Known product'],
        ['deliberate-intake-candidate', 'Intake candidate'],
        ['ambiguous-family', 'Ambiguous family'],
        ['bundle', 'Bundle'],
        ['dismissed-duplicate', 'Duplicate'],
      ]
    : [
        ['existing-canonical-retailer', 'Known store'],
        ['ambiguous-retailer', 'Ambiguous store'],
        ['dismissed-duplicate', 'Duplicate'],
      ];
}

export function ResearchInbox({
  rows,
  canManage,
}: {
  rows: PendingResearchTask[];
  canManage: boolean;
}) {
  const router = useRouter();
  const selection = useUrlInboxSelection();
  const controllerRef = useRef<OpsInboxController | null>(null);
  const [assignState, assignAction, assigning] = useActionState(assignResearchTaskAction, null);
  const [resolveState, resolveAction, resolving] = useActionState(resolveResearchTaskAction, null);

  useEffect(() => {
    if (!assignState?.ok) return;
    router.refresh();
  }, [assignState, router]);

  useEffect(() => {
    if (!resolveState?.ok || !resolveState.terminal) return;
    controllerRef.current?.settleItem(resolveState.targetId);
  }, [resolveState]);

  return (
    <>
      <InboxContainer
        controllerRef={controllerRef}
        items={rows}
        itemTypeLabel="research item"
        getItemLabel={row => row.entityLabel}
        selectedId={selection.selectedId}
        pendingSelectionId={selection.pendingSelectionId}
        onSelect={selection.onSelect}
        onDeselect={selection.onDeselect}
        renderItemRow={row => (
          <span className={styles.cardInner}>
            <span className={researchStyles.mark} aria-hidden="true">
              <Microscope size={24} strokeWidth={1.6} />
            </span>
            <span className={styles.cardBody}>
              <span className={styles.cardTitle}>{row.entityLabel}</span>
              <span className={styles.cardSubtext}>{taskLabel(row.taskKind)} · {row.signalCount} signal{row.signalCount === 1 ? '' : 's'}</span>
            </span>
            <ChevronRight size={16} className={styles.cardCaret} aria-hidden="true" />
          </span>
        )}
        renderItemDetails={row => {
          const targetRequired = row.entitySource === 'canonical';
          const defaultTarget = targetRequired ? row.entityRef : '';
          return (
            <div className={styles.detailContent}>
              <div className={styles.detailScroll}>
                <header className={styles.detailHeader}>
                  <h2 className={styles.detailTitle}>{row.entityLabel}</h2>
                  <div className={styles.detailMeta}>
                    <StatusPill tone={row.workState === 'blocked' ? 'danger' : 'info'}>
                      {row.workState}
                    </StatusPill>
                    <RelativeTime iso={row.lastSeenAt} />
                  </div>
                </header>
                <section className={styles.detailSection}>
                  <h3 className={styles.sectionLabel}>Work</h3>
                  <div className={styles.propertiesSection}>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Task</span><span className={styles.propertyValue}>{taskLabel(row.taskKind)}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Signals</span><span className={styles.propertyValue}>{row.signalCount}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Source</span><span className={styles.propertyValue}>{row.entitySource === 'canonical' ? 'Known record' : 'Needs identity review'}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Owner</span><span className={styles.propertyValue}>{row.assigneeName ?? 'Unassigned'}</span></div>
                    {row.nextAction ? <div className={styles.propertyRow}><span className={styles.propertyLabel}>Next action</span><span className={styles.propertyValue}>{row.nextAction}</span></div> : null}
                  </div>
                </section>
                <details className={styles.metadataDisclosure}>
                  <summary>Metadata</summary>
                  <div className={styles.metadataBody}>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Task ID</span><span className={styles.propertyValue}><IdChip value={row.id} label="research task" /></span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>Reference</span><span className={styles.propertyValue}>{row.entityRef}</span></div>
                    <div className={styles.propertyRow}><span className={styles.propertyLabel}>First seen</span><span className={styles.propertyValue}><RelativeTime iso={row.firstSeenAt} /></span></div>
                  </div>
                </details>
              </div>

              {canManage ? (
                <div className={researchStyles.actionStack}>
                  <form data-item-id={row.id} className={styles.decideSection} action={assignAction}>
                    <input type="hidden" name="targetId" value={row.id} />
                    <div className={styles.decideField}>
                      <label className={styles.decideNoteLabel} htmlFor={`next-${row.id}`}>Next action</label>
                      <textarea id={`next-${row.id}`} className={styles.note} name="rationale" required maxLength={2000} placeholder="Evidence or follow-up needed" disabled={assigning || resolving} />
                    </div>
                    {assignState && !assignState.ok && assignState.targetId === row.id ? <p role="alert" className={styles.permissionNote}>{assignState.error}</p> : null}
                    <div className={styles.actionButtons}>
                      <button className={styles.btn} type="submit" name="action" value="claim" disabled={assigning || resolving}>Assign to me</button>
                      <button className={`${styles.btn} ${styles.btnReject}`} type="submit" name="action" value="defer" disabled={assigning || resolving}>Block with reason</button>
                    </div>
                  </form>

                  <form data-item-id={row.id} className={styles.decideSection} action={resolveAction}>
                    <input type="hidden" name="targetId" value={row.id} />
                    <input type="hidden" name="entityKind" value={row.entityKind} />
                    <div className={styles.decideField}>
                      <label className={styles.decideNoteLabel} htmlFor={`outcome-${row.id}`}>Outcome</label>
                      <select id={`outcome-${row.id}`} name="outcome" className={researchStyles.select} defaultValue={outcomes(row)[0][0]}>
                        {outcomes(row).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div className={styles.decideField}>
                      <label className={styles.decideNoteLabel} htmlFor={`target-${row.id}`}>Exact target</label>
                      <input id={`target-${row.id}`} name="targetRef" className={researchStyles.input} defaultValue={defaultTarget} placeholder="Canonical slug or intake ID" />
                    </div>
                    <div className={styles.decideField}>
                      <label className={styles.decideNoteLabel} htmlFor={`rationale-${row.id}`}>Decision reason</label>
                      <textarea id={`rationale-${row.id}`} className={styles.note} name="rationale" required maxLength={2000} placeholder="Evidence supporting this outcome" disabled={assigning || resolving} />
                    </div>
                    {resolveState && !resolveState.ok && resolveState.targetId === row.id ? <p role="alert" className={styles.permissionNote}>{resolveState.error}</p> : null}
                    <div className={styles.actionButtons}>
                      <button className={`${styles.btn} ${styles.btnApprove}`} type="submit" disabled={assigning || resolving}>{resolving ? 'Saving…' : 'Record outcome'}</button>
                    </div>
                  </form>
                </div>
              ) : <p className={styles.permissionNote}>You cannot manage research work.</p>}
            </div>
          );
        }}
      />
      <span className={researchStyles.liveStatus} role="status" aria-live="polite">
        {resolveState?.ok ? 'Research outcome recorded.' : assignState?.ok ? 'Research work updated.' : ''}
      </span>
    </>
  );
}
