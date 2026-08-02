'use client';

import {
  Activity,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  Eye,
  FileText,
  GitFork,
  Mail,
  RefreshCw,
  Search,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type MouseEvent,
} from 'react';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import {
  InboxContainer,
  type InboxCollectionSection,
} from '@/components/ops/inbox/InboxContainer';
import { useContextFab } from '@/components/ops/shell/OpsShellContext';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import { OPS_MODAL_DIALOG_OPTIONS } from '@/components/ops/shell/use-ops-overlay';
import type {
  ConsoleOperatorActivity,
  ConsoleOperatorRecord,
} from '@/lib/moderation/operators';
import type { ModerationRole } from '@/lib/moderation/access';
import {
  inviteOperatorAction,
  mutateOperatorAccessAction,
} from './actions';
import { OperatorDetailSkeleton } from './OperatorDetailSkeleton';
import styles from './operators.module.css';

const number = new Intl.NumberFormat('en-NG');
const exactDate = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const roleLabels: Record<ModerationRole, string> = {
  moderator: 'Moderator',
  operator: 'Operator',
  admin: 'Admin',
};

const roleScope: Record<ModerationRole, string> = {
  moderator: 'Observations and relationships',
  operator: 'All review queues',
  admin: 'All review queues and team access',
};

const queueLabels: Record<ConsoleOperatorActivity['queue'], string> = {
  community_contribution: 'Community note',
  community_edge: 'Relationship',
  community_observation: 'Observation',
  community_moderation_value: 'Vocabulary',
  community_research_task: 'Research',
  retailer_application: 'Retailer',
  commerce_signal: 'Store signal',
};

const actionLabels: Record<ConsoleOperatorActivity['action'], string> = {
  claim: 'Claimed',
  assign: 'Assigned',
  unassign: 'Unassigned',
  approve: 'Approved',
  reject: 'Rejected',
  map: 'Matched',
  promote: 'Published',
  reconcile: 'Reconciled',
  defer: 'Deferred',
  retry: 'Retried',
  note: 'Noted',
};

const accessActionLabels: Record<
  Exclude<ConsoleOperatorRecord['recentAccessActivity'][number]['action'], 'send'>,
  string
> = {
  invite: 'Invited',
  accept: 'Invitation accepted',
  change_role: 'Role changed',
  deactivate: 'Access paused',
  reactivate: 'Access restored',
  revoke: 'Invitation revoked',
};

function accessActivityLabel(
  activity: ConsoleOperatorRecord['recentAccessActivity'][number],
) {
  if (activity.action !== 'send') return accessActionLabels[activity.action];
  if (activity.outcome === 'failed') return 'Email failed';
  if (activity.outcome === 'not_configured') return 'Saved without email';
  if (activity.outcome === 'attempted') return 'Sending started';
  return 'Invitation sent';
}

function QueueIcon({ queue }: { queue: ConsoleOperatorActivity['queue'] }) {
  const Icon: ComponentType<{ size?: number; strokeWidth?: number }> = queue === 'community_contribution'
    ? FileText
    : queue === 'community_edge'
      ? GitFork
      : queue === 'community_observation'
        ? Eye
        : queue === 'community_moderation_value'
          ? BookOpen
          : queue === 'community_research_task'
            ? Search
            : queue === 'retailer_application'
              ? Store
              : Activity;
  return <Icon size={17} strokeWidth={1.7} aria-hidden="true" />;
}

function operatorName(row: ConsoleOperatorRecord) {
  return row.displayName ?? row.email ?? 'Unnamed team member';
}

function initials(row: ConsoleOperatorRecord) {
  const source = row.displayName ?? row.email?.split('@')[0] ?? '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts.map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('en-NG') || 'JC';
}

function statusLabel(row: ConsoleOperatorRecord) {
  if (row.status === 'active') return 'Active';
  if (row.status === 'inactive') return 'Paused';
  if (row.status === 'pending') return 'Invitation waiting';
  if (row.status === 'expired') return 'Invitation expired';
  return 'Invitation revoked';
}

function deliveryLabel(row: ConsoleOperatorRecord) {
  if (row.deliveryStatus === 'sent') return 'Sent';
  if (row.deliveryStatus === 'failed') return 'Failed';
  if (row.deliveryStatus === 'not_configured') return 'Unavailable';
  return 'Not sent';
}

function sendInvitationLabel(
  row: ConsoleOperatorRecord,
  emailDeliveryReady: boolean,
) {
  if (!emailDeliveryReady) {
    return row.status === 'expired' ? 'Renew invitation' : null;
  }
  if (row.deliveryStatus === 'sent') return 'Send again';
  if (row.deliveryStatus === 'failed') return 'Try email again';
  return 'Send invitation';
}

function summary(row: ConsoleOperatorRecord) {
  if (row.kind === 'invitation') return statusLabel(row);
  if (row.decisionsToday > 0) {
    return `${number.format(row.decisionsToday)} ${row.decisionsToday === 1 ? 'decision' : 'decisions'} today`;
  }
  if (row.lastActionAt) return 'No decisions today';
  return 'No decisions yet';
}

function OperatorAvatar({
  row,
  className,
}: {
  row: ConsoleOperatorRecord;
  className: string;
}) {
  if (row.kind === 'invitation') {
    return (
      <span className={className} data-kind="invitation" aria-hidden="true">
        <Mail size={26} strokeWidth={1.6} />
      </span>
    );
  }
  return <span className={className} aria-hidden="true">{initials(row)}</span>;
}

function RoleEditor({
  row,
  currentOperatorId,
  disabled,
  action,
}: {
  row: ConsoleOperatorRecord;
  currentOperatorId: string;
  disabled: boolean;
  action: (payload: FormData) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<ModerationRole>(row.role);
  const isSelf = row.kind === 'operator' && row.id === currentOperatorId;

  return (
    <form className={styles.roleEditor} action={action}>
      <input type="hidden" name="action" value="change_role" />
      <input type="hidden" name="targetKind" value={row.kind} />
      <input type="hidden" name="targetId" value={row.id} />
      <fieldset disabled={disabled || isSelf || row.status === 'revoked'}>
        <legend>Role</legend>
        <div className={styles.roleChoices}>
          {(['moderator', 'operator', 'admin'] as const).map(role => (
            <label key={role} data-selected={selectedRole === role}>
              <input
                type="radio"
                name="role"
                value={role}
                checked={selectedRole === role}
                onChange={() => setSelectedRole(role)}
              />
              <span>{roleLabels[role]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {isSelf ? (
        <p className={styles.quietNote}>Ask another admin to change your role.</p>
      ) : row.status !== 'revoked' ? (
        <button
          type="submit"
          className={styles.secondaryButton}
          disabled={disabled || selectedRole === row.role}
        >
          {disabled ? 'Saving…' : 'Save role'}
        </button>
      ) : null}
    </form>
  );
}

type ConfirmAction = {
  action: 'deactivate' | 'revoke';
  targetKind: 'operator' | 'invitation';
  targetId: string;
  title: string;
  body: string;
  confirm: string;
};

type Notice = {
  message: string;
  tone: 'success' | 'notice' | 'warning';
};

function OperatorInspector({
  row,
  currentOperatorId,
  mutationState,
  isMutationPending,
  mutationAction,
  onConfirm,
  onCopySignInLink,
  accessLifecycleReady,
  emailDeliveryReady,
}: {
  row: ConsoleOperatorRecord;
  currentOperatorId: string;
  mutationState: Awaited<ReturnType<typeof mutateOperatorAccessAction>> | null;
  isMutationPending: boolean;
  mutationAction: (payload: FormData) => void;
  onConfirm: (event: MouseEvent<HTMLButtonElement>, action: ConfirmAction) => void;
  onCopySignInLink: () => void;
  accessLifecycleReady: boolean;
  emailDeliveryReady: boolean;
}) {
  const isSelf = row.kind === 'operator' && row.id === currentOperatorId;
  const feedback = mutationState?.targetId === row.id
    ? mutationState.ok
      ? mutationState.message
      : mutationState.error
    : null;
  const feedbackTone = mutationState?.tone ?? (mutationState?.ok ? 'success' : 'warning');
  const invitationSendLabel = sendInvitationLabel(row, emailDeliveryReady);
  const canCopySignInLink = row.status !== 'expired';

  return (
    <div className={styles.detail}>
      <div className={styles.detailScroll}>
        <section className={styles.detailIdentity}>
          <OperatorAvatar row={row} className={styles.detailAvatar} />
          <div>
            <h2>{operatorName(row)}</h2>
            {row.email ? <p>{row.email}</p> : null}
            {isSelf ? <span className={styles.youLabel}>You</span> : null}
          </div>
        </section>

        {feedback ? (
          <p
            className={
              feedbackTone === 'success'
                ? styles.successFeedback
                : feedbackTone === 'notice'
                  ? styles.noticeFeedback
                  : styles.errorFeedback
            }
            role={feedbackTone === 'warning' ? 'alert' : 'status'}
          >
            {feedbackTone === 'success' ? <Check size={15} aria-hidden="true" /> : null}
            {feedbackTone === 'warning' ? <CircleAlert size={15} aria-hidden="true" /> : null}
            {feedback}
          </p>
        ) : null}

        <section className={styles.detailSection}>
          <h3>Access</h3>
          <dl className={styles.facts}>
            <div><dt>Status</dt><dd>{statusLabel(row)}</dd></div>
            <div><dt>Role</dt><dd>{roleLabels[row.role]}</dd></div>
            <div><dt>Can review</dt><dd>{roleScope[row.role]}</dd></div>
            {row.kind === 'operator' ? (
              <div><dt>Added</dt><dd>{exactDate.format(new Date(row.createdAt))}</dd></div>
            ) : (
              <>
                <div><dt>Invited by</dt><dd>{row.invitedByName}</dd></div>
                <div><dt>Delivery</dt><dd>{deliveryLabel(row)}</dd></div>
                {row.lastSentAt ? (
                  <div><dt>Last sent</dt><dd><RelativeTime iso={row.lastSentAt} /></dd></div>
                ) : null}
                {row.expiresAt && row.status !== 'revoked' ? (
                  <div><dt>Expires</dt><dd>{exactDate.format(new Date(row.expiresAt))}</dd></div>
                ) : null}
              </>
            )}
          </dl>
        </section>

        {row.kind === 'operator' ? (
          <section className={styles.detailSection}>
            <h3>Work</h3>
            <dl className={styles.facts}>
              <div><dt>Today</dt><dd>{number.format(row.decisionsToday)}</dd></div>
              <div><dt>Last 7 days</dt><dd>{number.format(row.decisionsLast7Days)}</dd></div>
              <div><dt>All time</dt><dd>{number.format(row.decisionsTotal)}</dd></div>
              <div>
                <dt>Last decision</dt>
                <dd>{row.lastActionAt ? <RelativeTime iso={row.lastActionAt} /> : 'None yet'}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {row.recentActivity.length > 0 ? (
          <section className={styles.detailSection}>
            <h3>Recent work</h3>
            <ol className={styles.activityList}>
              {row.recentActivity.map(activity => (
                <li key={activity.id}>
                  <span className={styles.activityIcon}>
                    <QueueIcon queue={activity.queue} />
                  </span>
                  <span>
                    <strong>{activity.targetLabel}</strong>
                    <small>
                      {actionLabels[activity.action]} {queueLabels[activity.queue].toLocaleLowerCase('en-NG')}
                      {' · '}<RelativeTime iso={activity.createdAt} />
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/ops/activity" className={styles.textLink}>
              View all activity <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </section>
        ) : row.kind === 'operator' ? (
          <section className={styles.detailSection}>
            <h3>Recent work</h3>
            <p className={styles.emptyCopy}>No decisions yet.</p>
          </section>
        ) : null}

        {row.recentAccessActivity.length > 0 ? (
          <section className={styles.detailSection}>
            <h3>Access history</h3>
            <ol className={styles.accessHistory}>
              {row.recentAccessActivity.map(activity => (
                <li key={activity.id}>
                  <span>{accessActivityLabel(activity)}</span>
                  <RelativeTime iso={activity.createdAt} />
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {accessLifecycleReady ? (
          <section className={styles.detailSection}>
            <RoleEditor
              key={`${row.id}:${row.role}`}
              row={row}
              currentOperatorId={currentOperatorId}
              disabled={isMutationPending}
              action={mutationAction}
            />
          </section>
        ) : (
          <section className={styles.detailSection}>
            <h3>Access changes</h3>
            <p className={styles.emptyCopy}>Updates will be available after setup.</p>
          </section>
        )}
      </div>

      {accessLifecycleReady ? (
        <section className={styles.detailDecision}>
          <h3>Actions</h3>
          <div className={styles.actionStack}>
            {row.kind === 'invitation' && row.status !== 'revoked' ? (
              <>
                {invitationSendLabel ? (
                  <form action={mutationAction}>
                    <input type="hidden" name="action" value="resend" />
                    <input type="hidden" name="targetKind" value="invitation" />
                    <input type="hidden" name="targetId" value={row.id} />
                    <button className={styles.primaryButton} type="submit" disabled={isMutationPending}>
                      <RefreshCw size={16} aria-hidden="true" />
                      {isMutationPending
                        ? invitationSendLabel === 'Renew invitation' ? 'Renewing…' : 'Sending…'
                        : invitationSendLabel}
                    </button>
                  </form>
                ) : null}
                {canCopySignInLink ? (
                  <button
                    className={invitationSendLabel ? styles.secondaryButton : styles.primaryButton}
                    type="button"
                    disabled={isMutationPending}
                    onClick={onCopySignInLink}
                  >
                    <Copy size={16} aria-hidden="true" />
                    Copy sign-in link
                  </button>
                ) : null}
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={isMutationPending}
                  onClick={event => onConfirm(event, {
                    action: 'revoke',
                    targetKind: 'invitation',
                    targetId: row.id,
                    title: 'Revoke this invitation?',
                    body: `${row.email ?? 'This email'} will no longer be able to join from this invitation.`,
                    confirm: 'Revoke invitation',
                  })}
                >
                  Revoke invitation
                </button>
              </>
            ) : row.kind === 'operator' && row.status === 'active' && !isSelf ? (
              <button
                className={styles.dangerButton}
                type="button"
                disabled={isMutationPending}
                onClick={event => onConfirm(event, {
                  action: 'deactivate',
                  targetKind: 'operator',
                  targetId: row.id,
                  title: 'Pause this access?',
                  body: `${operatorName(row)} will be signed out of future JeloCare Ops visits.`,
                  confirm: 'Pause access',
                })}
              >
                Pause access
              </button>
            ) : row.kind === 'operator' && row.status === 'inactive' ? (
              <form action={mutationAction}>
                <input type="hidden" name="action" value="reactivate" />
                <input type="hidden" name="targetKind" value="operator" />
                <input type="hidden" name="targetId" value={row.id} />
                <button className={styles.primaryButton} type="submit" disabled={isMutationPending}>
                  {isMutationPending ? 'Restoring…' : 'Restore access'}
                </button>
              </form>
            ) : isSelf ? (
              <p className={styles.quietNote}>Ask another admin to pause your access.</p>
            ) : (
              <p className={styles.quietNote}>This invitation is closed.</p>
            )}
          </div>
          <p className={styles.boundary}>Every access change stays recorded.</p>
        </section>
      ) : null}
    </div>
  );
}

export function OperatorsDirectory({
  rows,
  currentOperatorId,
  accessLifecycleReady,
  emailDeliveryReady,
  signInHref,
}: {
  rows: ConsoleOperatorRecord[];
  currentOperatorId: string;
  accessLifecycleReady: boolean;
  emailDeliveryReady: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeSelectedId = searchParams.get('id');
  const [isSelectionPending, startSelectionTransition] = useTransition();
  const [selectedId, setOptimisticSelectedId] = useOptimistic(
    routeSelectedId,
    (_current, next: string | null) => next,
  );
  const [inviteState, inviteAction, isInviting] = useActionState(inviteOperatorAction, null);
  const [mutationState, mutationAction, isMutationPending] = useActionState(
    mutateOperatorAccessAction,
    null,
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const inviteTitleId = useId();
  const confirmTitleId = useId();
  const {
    dialogRef: inviteDialogRef,
    triggerRef: inviteTriggerRef,
    open: openInviteDialog,
    close: closeInviteDialog,
  } = useModalDialog(OPS_MODAL_DIALOG_OPTIONS);
  const {
    dialogRef: confirmDialogRef,
    triggerRef: confirmTriggerRef,
    open: openConfirmDialog,
    close: closeConfirmDialog,
  } = useModalDialog(OPS_MODAL_DIALOG_OPTIONS);
  const setContextFab = useContextFab();
  const emailRef = useRef<HTMLInputElement>(null);
  const inviteFormRef = useRef<HTMLFormElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const sections = useMemo<InboxCollectionSection<ConsoleOperatorRecord>[]>(() => [
    {
      id: 'active-team',
      label: 'Team',
      presentation: 'feature-shelf',
      itemIds: rows.filter(row => row.status === 'active').map(row => row.id),
    },
    {
      id: 'invitations',
      label: 'Invitations',
      presentation: 'compact-rows',
      itemIds: rows
        .filter(row => row.status === 'pending' || row.status === 'expired')
        .map(row => row.id),
    },
    {
      id: 'paused-access',
      label: 'Paused',
      presentation: 'compact-rows',
      itemIds: rows
        .filter(row => row.status === 'inactive' || row.status === 'revoked')
        .map(row => row.id),
    },
  ], [rows]);

  const select = useCallback((id: string | null) => {
    if (id === selectedId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('id', id);
    else params.delete('id');
    const query = params.toString();
    startSelectionTransition(() => {
      setOptimisticSelectedId(id);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }, [
    pathname,
    router,
    searchParams,
    selectedId,
    setOptimisticSelectedId,
  ]);

  const showNotice = useCallback((next: Notice) => {
    if (noticeTimerRef.current != null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice(next);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, next.tone === 'warning' ? 4200 : 2800);
  }, []);

  const copySignInLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(signInHref);
      showNotice({ message: 'Sign-in link copied.', tone: 'success' });
    } catch {
      showNotice({
        message: 'Couldn’t copy the sign-in link.',
        tone: 'warning',
      });
    }
  }, [showNotice, signInHref]);

  useEffect(() => () => {
    if (noticeTimerRef.current != null) {
      window.clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const openInvite = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    if (event) inviteTriggerRef.current = event.currentTarget;
    else {
      inviteTriggerRef.current = document.querySelector<HTMLButtonElement>(
        '[data-ops-context-fab]',
      );
    }
    openInviteDialog();
    if (accessLifecycleReady) {
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }, [accessLifecycleReady, inviteTriggerRef, openInviteDialog]);

  useEffect(() => {
    setContextFab({
      icon: UserPlus,
      label: 'Add admin',
      onClick: openInvite,
    });
    return () => setContextFab(null);
  }, [openInvite, setContextFab]);

  useEffect(() => {
    if (!inviteState?.ok) return;
    const settleTimer = window.setTimeout(() => {
      inviteFormRef.current?.reset();
      closeInviteDialog();
      if (inviteState.targetId) select(inviteState.targetId);
      showNotice({
        message: inviteState.message ?? 'Invitation saved.',
        tone: inviteState.tone ?? 'success',
      });
    }, 0);
    return () => window.clearTimeout(settleTimer);
  }, [closeInviteDialog, inviteState, select, showNotice]);

  useEffect(() => {
    if (!mutationState?.ok) return;
    const settleTimer = window.setTimeout(() => {
      closeConfirmDialog();
      showNotice({
        message: mutationState.message ?? 'Access updated.',
        tone: mutationState.tone ?? 'success',
      });
    }, 0);
    return () => window.clearTimeout(settleTimer);
  }, [closeConfirmDialog, mutationState, showNotice]);

  function askForConfirmation(
    event: MouseEvent<HTMLButtonElement>,
    action: ConfirmAction,
  ) {
    confirmTriggerRef.current = event.currentTarget;
    setConfirmAction(action);
    openConfirmDialog();
  }

  return (
    <>
      <div className={styles.toolbar}>
        <span>
          {rows.filter(row => row.status === 'active').length}{' '}
          {rows.filter(row => row.status === 'active').length === 1 ? 'active team member' : 'active team members'}
        </span>
        <button type="button" onClick={openInvite}>
          <UserPlus size={16} aria-hidden="true" />
          Add admin
        </button>
      </div>

      {notice ? (
        <p
          className={styles.notice}
          data-tone={notice.tone}
          role={notice.tone === 'warning' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {notice.tone === 'success' ? <Check size={15} aria-hidden="true" /> : null}
          {notice.tone === 'warning' ? <CircleAlert size={15} aria-hidden="true" /> : null}
          {notice.message}
        </p>
      ) : null}

      <div className={styles.directory}>
        <InboxContainer
          items={rows}
          sections={sections}
          itemTypeLabel="team member"
          collectionLabel="Team access"
          getItemLabel={operatorName}
          selectedId={selectedId}
          pendingSelectionId={isSelectionPending ? selectedId : null}
          onSelect={row => select(row.id)}
          onDeselect={() => select(null)}
          autoSelectFirst
          registerContextFab={false}
          renderItemRow={(row, _active, context) => context?.presentation === 'feature-shelf' ? (
            <span className={styles.featureCard}>
              <OperatorAvatar row={row} className={styles.featureAvatar} />
              <span className={styles.featureCopy}>
                <span className={styles.featureEyebrow}>
                  {roleLabels[row.role]}{row.id === currentOperatorId ? ' · You' : ''}
                </span>
                <strong>{operatorName(row)}</strong>
                <span>{row.email}</span>
                <small>{summary(row)}</small>
              </span>
            </span>
          ) : (
            <span className={styles.compactRow}>
              <OperatorAvatar row={row} className={styles.compactAvatar} />
              <span className={styles.compactCopy}>
                <strong>{operatorName(row)}</strong>
                <span>{roleLabels[row.role]} · {statusLabel(row)}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </span>
          )}
          renderItemDetails={row => isSelectionPending && selectedId === row.id ? (
            <OperatorDetailSkeleton />
          ) : (
            <OperatorInspector
              row={row}
              currentOperatorId={currentOperatorId}
              mutationState={mutationState}
              isMutationPending={isMutationPending}
              mutationAction={mutationAction}
              onConfirm={askForConfirmation}
              onCopySignInLink={copySignInLink}
              accessLifecycleReady={accessLifecycleReady}
              emailDeliveryReady={emailDeliveryReady}
            />
          )}
        />
      </div>

      <dialog
        ref={inviteDialogRef}
        className={styles.dialog}
        aria-labelledby={inviteTitleId}
        onCancel={event => {
          event.preventDefault();
          closeInviteDialog();
        }}
        onClick={event => {
          if (event.target === inviteDialogRef.current) closeInviteDialog();
        }}
      >
        <section className={styles.dialogSheet}>
          <header className={styles.dialogHeader}>
            <div>
              <span>Team access</span>
              <h2 id={inviteTitleId}>Add an admin.</h2>
              <p>
                {emailDeliveryReady
                  ? 'They’ll verify this email before access begins.'
                  : 'Save their email, then share the sign-in link.'}
              </p>
            </div>
            <button type="button" onClick={closeInviteDialog} aria-label="Close invitation">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {accessLifecycleReady ? (
            <form ref={inviteFormRef} action={inviteAction} className={styles.inviteForm}>
              <label htmlFor="operator-email">Email</label>
              <input
                ref={emailRef}
                id="operator-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@jelocare.com"
                disabled={isInviting}
              />
              {inviteState && !inviteState.ok ? (
                <p className={styles.errorFeedback} role="alert">{inviteState.error}</p>
              ) : null}
              <button className={styles.primaryButton} type="submit" disabled={isInviting}>
                {isInviting
                  ? emailDeliveryReady ? 'Sending…' : 'Saving…'
                  : emailDeliveryReady ? 'Send invitation' : 'Save invitation'}
              </button>
            </form>
          ) : (
            <p className={styles.setupMessage}>Access updates will be available after setup.</p>
          )}
        </section>
      </dialog>

      <dialog
        ref={confirmDialogRef}
        className={styles.dialog}
        aria-labelledby={confirmTitleId}
        onCancel={event => {
          event.preventDefault();
          closeConfirmDialog();
        }}
        onClick={event => {
          if (event.target === confirmDialogRef.current) closeConfirmDialog();
        }}
      >
        <section className={styles.confirmSheet}>
          <header className={styles.dialogHeader}>
            <div>
              <span>Confirm access</span>
              <h2 id={confirmTitleId}>{confirmAction?.title}</h2>
              <p>{confirmAction?.body}</p>
            </div>
            <button type="button" onClick={closeConfirmDialog} aria-label="Close confirmation">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {confirmAction ? (
            <form action={mutationAction} className={styles.confirmActions}>
              <input type="hidden" name="action" value={confirmAction.action} />
              <input type="hidden" name="targetKind" value={confirmAction.targetKind} />
              <input type="hidden" name="targetId" value={confirmAction.targetId} />
              {mutationState?.targetId === confirmAction.targetId && !mutationState.ok ? (
                <p className={styles.errorFeedback} role="alert">{mutationState.error}</p>
              ) : null}
              <button type="button" className={styles.secondaryButton} onClick={closeConfirmDialog}>
                Keep access
              </button>
              <button type="submit" className={styles.dangerSolidButton} disabled={isMutationPending}>
                {isMutationPending ? 'Saving…' : confirmAction.confirm}
              </button>
            </form>
          ) : null}
        </section>
      </dialog>

      <p className="sr-only" role="status" aria-live="polite">
        {isSelectionPending ? 'Loading team member.' : ''}
      </p>
    </>
  );
}
