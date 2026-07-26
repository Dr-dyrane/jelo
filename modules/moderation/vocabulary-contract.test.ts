import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('Vocabulary uses a title-only workspace and truthful bounded state', async () => {
  const page = await readSource('app/(ops)/ops/vocabulary/page.tsx');
  assert.match(page, /<OpsWorkspace title="Vocabulary">/);
  assert.doesNotMatch(page, /\blede=/);
  assert.match(page, /listPendingModerationValues\(sql, LIMIT \+ 1\)/);
  assert.match(page, /fetchedRows\.slice\(0, LIMIT\)/);
  assert.match(page, /fetchedRows\.length > LIMIT/);
  assert.match(page, /Nothing awaiting review/);
});

test('Vocabulary ranks active retained evidence instead of historical counters', async () => {
  const queues = await readSource('lib/moderation/queues.ts');
  assert.match(queues, /from community_moderation_mentions mention/);
  assert.match(queues, /contribution\.moderation_status <> 'rejected'/);
  assert.match(queues, /contribution\.retain_until > now\(\)/);
  assert.match(queues, /order by active\.active_mention_count desc/);
  assert.doesNotMatch(queues, /PendingModerationValue[\s\S]*?occurrenceCount/);
});

test('Vocabulary is a grouped language workspace, not an approval table', async () => {
  const inbox = await readSource('app/(ops)/ops/vocabulary/VocabularyInbox.tsx');
  assert.match(inbox, /label: 'Up next'/);
  assert.match(inbox, /presentation: 'feature-shelf'/);
  assert.match(inbox, /product: 'Products'/);
  assert.match(inbox, /retailer: 'Stores'/);
  assert.match(inbox, /brand: 'Brands'/);
  assert.match(inbox, /purpose: 'Uses'/);
  assert.match(inbox, />\s*\{isMapPending[\s\S]*?: 'Same as known'\}/);
  assert.match(inbox, /Keep as new/);
  assert.match(inbox, /Not useful/);
  assert.doesNotMatch(inbox, />Approve</);
  assert.doesNotMatch(inbox, />Reject</);
  assert.doesNotMatch(inbox, /Match an existing record/);
});

test('Vocabulary matching uses a responsive dialog and same-kind suggestions', async () => {
  const [picker, presentation, page, actions, css] = await Promise.all([
    readSource('app/(ops)/ops/vocabulary/VocabularyTargetPicker.tsx'),
    readSource('lib/moderation/vocabulary-presentation.ts'),
    readSource('app/(ops)/ops/vocabulary/page.tsx'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('app/(ops)/ops/vocabulary/vocabulary.module.css'),
  ]);
  assert.match(picker, /useModalDialog/);
  assert.match(picker, /<dialog/);
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /role="option"/);
  assert.match(picker, /rankVocabularyTargets\(term, valueKind, targets, query\)/);
  assert.match(picker, /vocabularyDisplayTarget/);
  assert.doesNotMatch(picker, /vocabularyDisplayText/);
  assert.match(presentation, /\.filter\(target => target\.kind === kind\)/);
  assert.match(css, /@media \(min-width: 600px\) and \(max-width: 1179px\)/);
  assert.match(css, /@media \(min-width: 1180px\)/);
  assert.doesNotMatch(`${picker}\n${presentation}`, /<select|Entity reference|Normalized/);
  assert.match(page, /can\(operator\.role, 'vocabulary\.map'\)/);
  assert.match(actions, /assertCan\(operator, 'vocabulary\.map'\)/);
  assert.match(actions, /mapValueInputSchema\.parse/);
});

test('Selected matches edit on the main control and clear only with X', async () => {
  const picker = await readSource('app/(ops)/ops/vocabulary/VocabularyTargetPicker.tsx');
  assert.match(picker, /className=\{styles\.selectedTargetMain\}[\s\S]*?onClick=\{openPicker\}/);
  assert.match(picker, /className=\{styles\.clearTarget\}[\s\S]*?aria-label=\{`Clear \$\{targetLabel\(selected\)\}`\}[\s\S]*?onClick=\{\(\) => onSelect\(null\)\}/);
});

test('Vocabulary matching keeps the focused dialog in control', async () => {
  const [picker, inbox] = await Promise.all([
    readSource('app/(ops)/ops/vocabulary/VocabularyTargetPicker.tsx'),
    readSource('components/ops/inbox/InboxContainer.tsx'),
  ]);
  assert.match(picker, /requestAnimationFrame\(\(\) => inputRef\.current\?\.focus\(\)\)/);
  assert.match(picker, /onCancel=\{event => \{\s*event\.preventDefault\(\);\s*close\(\);/);
  assert.match(inbox, /const nestedDialog = document\.querySelector<HTMLDialogElement>\('dialog\[open\]'\);/);
  assert.match(inbox, /if \(eventDialog \|\| nestedDialog\) return;/);
});

test('Server settlement rejects cross-kind and unpublished product targets', async () => {
  const [transitions, queues] = await Promise.all([
    readSource('lib/moderation/database-transitions.ts'),
    readSource('lib/moderation/queues.ts'),
  ]);
  assert.match(transitions, /and value_kind = \$\{canonicalEntityKind\}/);
  assert.match(
    transitions,
    /if \(rows\.length === 0\) return null;\s+await recordModerationAction\(tx, \{[\s\S]*?metadata: \{ canonicalEntityKind, canonicalEntityRef \}/,
  );
  assert.match(transitions, /where slug = \$\{ref\} and is_published = true/);
  assert.match(queues, /where product\.is_published = true/);
});

test('Vocabulary shows source context and confirms the not-useful consequence', async () => {
  const [queues, presentation, inbox] = await Promise.all([
    readSource('lib/moderation/queues.ts'),
    readSource('lib/moderation/vocabulary-presentation.ts'),
    readSource('app/(ops)/ops/vocabulary/VocabularyInbox.tsx'),
  ]);
  assert.match(queues, /recent_contexts/);
  assert.match(presentation, /recentContexts: row\.recentContexts\.map\(reportContext\)/);
  assert.match(inbox, /Where it appeared/);
  assert.match(inbox, /<h3 className=\{styles\.sectionLabel\}>Seen<\/h3>/);
  assert.match(inbox, /Mark this as not useful\?/);
  assert.match(inbox, /original reports stay unchanged/);
  assert.match(inbox, /Keep reviewing/);
});

test('Vocabulary partial state continues from its own scroll root', async () => {
  const [queues, page, actions, inbox] = await Promise.all([
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/vocabulary/page.tsx'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('app/(ops)/ops/vocabulary/VocabularyInbox.tsx'),
  ]);
  assert.match(queues, /active\.active_mention_count < \$\{after\.activeMentionCount\}/);
  assert.match(queues, /\(active\.first_seen_at, value\.id\) > \(/);
  assert.match(page, /initialHasMore=\{hasMore\}/);
  assert.match(page, /initialCursor=\{nextCursor\}/);
  assert.match(actions, /export async function fetchMoreVocabularyAction/);
  assert.match(inbox, /new IntersectionObserver/);
  assert.match(inbox, /document\.querySelector<HTMLElement>\('\[data-ops-main\]'\)/);
  assert.match(inbox, /ref=\{loadSentinelRef\}/);
});

test('Vocabulary loading mirrors the ready workspace and honest inspector', async () => {
  const [loading, detail, error, inbox] = await Promise.all([
    readSource('app/(ops)/ops/vocabulary/loading.tsx'),
    readSource('app/(ops)/ops/vocabulary/VocabularyDetailSkeleton.tsx'),
    readSource('app/(ops)/ops/vocabulary/error.tsx'),
    readSource('app/(ops)/ops/vocabulary/VocabularyInbox.tsx'),
  ]);
  assert.doesNotMatch(loading, /useSearchParams|role="dialog"|tabletStage/);
  assert.doesNotMatch(loading, /selectedId|searchParams/);
  assert.match(loading, /<h2>Up next<\/h2>/);
  assert.match(loading, /\['Products', 'Stores', 'Brands', 'Uses'\]/);
  assert.match(loading, /data-ops-reserve-detail/);
  assert.match(loading, /createPortal\(<VocabularyDetailSkeleton announce=\{false\} \/>/);
  assert.match(detail, /Where it appeared/);
  assert.match(detail, /vocabularyStyles\.reportList/);
  assert.match(detail, /Choose what it means/);
  assert.match(error, /title="Couldn’t load vocabulary"/);
  assert.doesNotMatch(error, /\{error\.(?:message|stack)\}/);
  assert.match(inbox, /selection\.pendingSelectionId === row\.id/);
  assert.match(inbox, /role="status" aria-live="polite"/);
  assert.doesNotMatch(inbox, /<kbd\b|kbdBadge|Raw payload/);
});
