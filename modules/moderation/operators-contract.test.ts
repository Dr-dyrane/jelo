import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('operator invitations grant nothing until Neon Auth verifies the exact email', async () => {
  const [migration, access, identity, authSubject] = await Promise.all([
    readSource('db/migrations/0025_operator_access_lifecycle.sql'),
    readSource('lib/moderation/operator-access.ts'),
    readSource('lib/moderation/access.ts'),
    readSource('lib/auth/subject.ts'),
  ]);

  assert.match(migration, /create table moderation_operator_invitations/);
  assert.match(migration, /email = lower\(btrim\(email\)\)/);
  assert.match(migration, /where status = 'pending'/);
  assert.match(migration, /accepted_operator_id uuid references moderation_operators/);
  assert.match(migration, /create table moderation_operator_access_audit/);
  assert.match(migration, /create unique index moderation_operators_active_email_idx/);
  assert.match(migration, /moderation_operators_normalized_email_check/);

  assert.match(access, /operatorEmailSchema\.parse\(rawEmail\)/);
  assert.match(access, /operatorEmailSchema\.safeParse\(identity\.email\)/);
  assert.match(access, /if \(!parsedEmail\.success\) return null/);
  assert.match(access, /!identity\.email \|\| !identity\.emailVerified/);
  assert.match(access, /lower\(email\) = \$\{email\}/);
  assert.match(access, /auth_subject,[\s\S]*identity\.subject/);
  assert.doesNotMatch(access, /authSubject:\s*email/);
  assert.match(authSubject, /emailVerified: user\.emailVerified === true/);
  assert.match(identity, /const identity = await getAuthSubject\(\)/);
  assert.match(identity, /claimPendingOperatorInvitation\(sql, identity\)/);
  assert.match(identity, /return resolveActiveOperator\(sql, identity\.subject\)/);
});

test('operator access changes are admin-only, guarded, and separately audited', async () => {
  const [actions, access, signInUrl, signInPage, mailer, templates] = await Promise.all([
    readSource('app/(ops)/ops/operators/actions.ts'),
    readSource('lib/moderation/operator-access.ts'),
    readSource('lib/auth/operator-sign-in-url.ts'),
    readSource('app/(auth)/sign-in/page.tsx'),
    readSource('lib/email/mailer.ts'),
    readSource('lib/email/templates.ts'),
  ]);

  assert.match(actions, /assertCan\(actor, 'operators\.manage'\)/);
  assert.match(actions, /inviteInput = z\.object\(\{\s*email: operatorEmailSchema/);
  assert.doesNotMatch(actions, /displayName|authSubject/);
  assert.match(actions, /hasTransactionalEmailConfig\(\)/);
  assert.match(actions, /recordOperatorInvitationDelivery/);
  assert.match(actions, /Access updates aren’t ready yet\./);
  assert.match(actions, /deliverInvitation\(sql, actor, invitation, 'first'\)/);
  assert.match(actions, /deliverInvitation\(sql, actor, invitation, 'again'\)/);
  assert.match(actions, /error\.code === 'existing_invitation'[\s\S]*error\.targetId/);
  assert.match(actions, /Invitation already saved\. Open it to send again\./);
  assert.doesNotMatch(actions, /Email is not connected/);
  assert.match(actions, /signInLink: operatorSignInUrl\(\)/);
  assert.match(signInUrl, /https:\/\/www\.jelocare\.com/);
  assert.match(signInUrl, /return new URL\('\/sign-in', LIVE_SITE\)\.toString\(\)/);
  assert.doesNotMatch(signInUrl, /NEXT_PUBLIC_SITE_URL|process\.env|localhost|vercel\.app/);
  assert.match(signInPage, /emailOtp\.sendVerificationOtp/);
  assert.match(signInPage, /signIn\.emailOtp/);
  assert.match(signInPage, /window\.location\.assign\('\/ops'\)/);
  assert.match(mailer, /operatorInvitationEmail\(\{\s*email: input\.to,/);
  assert.match(templates, /Invited email: \$\{input\.email\}/);
  assert.match(templates, /const email = escapeHtml\(input\.email\)/);
  assert.match(templates, /<strong>\$\{email\}<\/strong>/);

  assert.match(access, /existing_operator/);
  assert.match(access, /existing_invitation/);
  assert.match(access, /public readonly targetId\?: string/);
  assert.match(access, /new OperatorAccessError\(\s*'existing_invitation',\s*existingInvitations\[0\]\.id/);
  assert.match(access, /self_role_change/);
  assert.match(access, /self_deactivation/);
  assert.match(access, /last_active_admin/);
  assert.match(access, /lockActiveAdmin\(tx, actor\)/);
  assert.match(access, /pg_advisory_xact_lock/);
  assert.match(access, /lockOperatorEmail\(tx, email\)/);
  assert.match(access, /invitation\.delivery_status !== 'not_configured'/);
  assert.match(access, /Transactional database access is required/);
  assert.doesNotMatch(access, /:\s*run\(sql\)/);
  assert.match(access, /insert into moderation_operator_access_audit/);
  assert.doesNotMatch(access, /update moderation_operator_access_audit/);
});

test('the Operators route is a title-only split-view workspace with honest states', async () => {
  const [page, directory, loading, error, readModel, css, inbox] = await Promise.all([
    readSource('app/(ops)/ops/operators/page.tsx'),
    readSource('app/(ops)/ops/operators/OperatorsDirectory.tsx'),
    readSource('app/(ops)/ops/operators/loading.tsx'),
    readSource('app/(ops)/ops/operators/error.tsx'),
    readSource('lib/moderation/operators.ts'),
    readSource('app/(ops)/ops/operators/operators.module.css'),
    readSource('components/ops/inbox/InboxContainer.tsx'),
  ]);

  assert.match(page, /<OpsWorkspace title="Operators">/);
  assert.match(page, /accessLifecycleReady=\{directory\.accessLifecycleReady\}/);
  assert.match(page, /emailDeliveryReady=\{hasTransactionalEmailConfig\(\)\}/);
  assert.match(page, /signInHref=\{operatorSignInUrl\(\)\}/);
  assert.doesNotMatch(page, /\blede=|<h1|read-only|auth subject/i);

  assert.match(directory, /presentation: 'feature-shelf'/);
  assert.match(directory, /presentation: 'compact-rows'/);
  assert.match(directory, /useContextFab/);
  assert.match(directory, /Add admin/);
  assert.match(directory, /type="email"/);
  assert.match(directory, /<dialog/);
  assert.match(directory, /accessLifecycleReady \?/);
  assert.match(directory, /\sautoSelectFirst(?:\s|\/>)/);
  assert.match(directory, /registerContextFab=\{false\}/);
  assert.match(directory, /inviteFormRef\.current\?\.reset\(\)/);
  assert.match(directory, /if \(inviteState\.targetId\) select\(inviteState\.targetId\)/);
  assert.match(directory, /Copy sign-in link/);
  assert.match(directory, /navigator\.clipboard\.writeText\(signInHref\)/);
  assert.match(directory, /row\.status === 'expired' \? 'Renew invitation' : null/);
  assert.match(directory, /const canCopySignInLink = row\.status !== 'expired'/);
  assert.match(directory, /Save invitation/);
  assert.match(directory, /Try email again/);
  assert.doesNotMatch(directory, /Email is not connected/);
  assert.match(directory, /<\/div>\s*\{accessLifecycleReady \? \(\s*<section className=\{styles\.detailDecision\}>/);
  assert.match(directory, /isSelectionPending && selectedId === row\.id/);
  assert.doesNotMatch(directory, /operator\.authSubject|Signal ID|Operator ID/);

  assert.doesNotMatch(loading, /useSearchParams|searchParams|selectedId/);
  assert.match(loading, /matchMedia\('\(min-width: 1180px\)'\)/);
  assert.match(loading, /if \(!isDesktop \|\| !detailPortalTarget\) return null/);
  assert.match(loading, /data-ops-reserve-detail/);
  assert.match(loading, /OperatorDetailSkeleton announce=\{false\}/);
  assert.match(inbox, /usesDockedInspector && activeItem && detailPortalTarget/);
  assert.match(inbox, /usesOverlayInspector && activeItem && detailPortalTarget && overlayInspectorOpen/);
  assert.match(error, /Couldn’t load team access/);
  assert.doesNotMatch(error, /error\.(?:message|stack)/);

  assert.match(readModel, /isOperatorAccessLifecycleUnavailable/);
  assert.match(readModel, /accessLifecycleReady = false/);
  assert.match(readModel, /const \[rows, recentRows\] = await Promise\.all/);
  assert.match(readModel, /audit\.metadata,[\s\S]*metadata ->> 'outcome'/);
  assert.match(readModel, /metadata ->> 'outcome'/);

  assert.match(css, /\.detailScroll[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.detailDecision[\s\S]*flex:\s*0 0 auto/);
  assert.match(css, /\[aria-current='true'\][\s\S]*outline:\s*0/);
  assert.match(css, /\[aria-current='true'\]:focus-visible[\s\S]*outline:\s*2px solid var\(--ops-focus-ring\)/);
  assert.doesNotMatch(css, /text-transform:\s*uppercase/);
  assert.doesNotMatch(css, /letter-spacing:\s*\.(?:0[5-9]|[1-9])em/);
  assert.match(css, /@media \(min-width: 430px\) and \(max-width: 599px\)/);
  assert.match(css, /@media \(max-width: 429px\)/);
  assert.match(
    css,
    /@media \(max-width: 1179px\)[\s\S]*\.toolbar > button\s*\{\s*display:\s*none/,
  );
  assert.doesNotMatch(css, /font-weight:\s*(?:700|800|900|bold)/);
  assert.match(css, /\.primaryButton[\s\S]*border-radius:\s*var\(--ops-control-radius\)/);
});
