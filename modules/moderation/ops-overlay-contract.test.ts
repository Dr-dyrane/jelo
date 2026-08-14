import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("temporary Ops overlays share one complete interaction contract", async () => {
  const hook = await readSource("components/ops/shell/use-ops-overlay.ts");

  assert.match(hook, /scrollOwnerSelector = '\[data-ops-main\]'/);
  assert.match(hook, /scrollOwner\.style\.overflow = 'hidden'/);
  assert.doesNotMatch(hook, /document\.body\.style\.overflow/);
  assert.match(hook, /target\.setAttribute\('inert', ''\)/);
  assert.match(
    hook,
    /if \(!previousInert\[index\]\) target\.removeAttribute\('inert'\)/,
  );
  assert.match(hook, /event\.key === 'Escape'/);
  assert.match(hook, /event\.key !== 'Tab'/);
  assert.match(
    hook,
    /document\.addEventListener\('keydown', handleKeyDown, true\)/,
  );
  assert.match(
    hook,
    /document\.removeEventListener\('keydown', handleKeyDown, true\)/,
  );
  assert.match(hook, /focusTarget\?\.isConnected/);
  assert.match(hook, /focusTarget\.focus\(\{ preventScroll: true \}\)/);
});

test("the shell navigation overlay preserves its exact trigger and inert planes", async () => {
  const chrome = await readSource("components/ops/shell/OpsChrome.tsx");

  assert.match(
    chrome,
    /import \{ useOpsOverlay \} from ["']\.\/use-ops-overlay["']/,
  );
  assert.match(chrome, /sidebarTriggerRef\.current = trigger/);
  assert.match(
    chrome,
    /useOpsOverlay\(\{[\s\S]*open: sidebarOpen,[\s\S]*returnFocusRef: sidebarTriggerRef/,
  );
  assert.match(chrome, /["']\[data-ops-workspace\]["']/);
  assert.match(chrome, /["']\[data-ops-detail\]["']/);
  assert.match(chrome, /role=\{sidebarOpen \? ["']dialog["'] : undefined\}/);
  assert.match(
    chrome,
    /aria-modal=\{sidebarOpen \? ["']true["'] : undefined\}/,
  );
  assert.match(
    chrome,
    /onClick=\{\(event\) => toggleSidebar\(event\.currentTarget\)\}/,
  );
  assert.match(
    chrome,
    /className=\{adaptive\.sidebarScrim\}[\s\S]*tabIndex=\{-1\}[\s\S]*aria-hidden="true"/,
  );
  assert.doesNotMatch(chrome, /window\.addEventListener\(["']keydown["']/);
});

test("Overview uses the shared overlay contract without inventing a second modal system", async () => {
  const overview = await readSource("app/(ops)/ops/OverviewBriefing.tsx");

  assert.match(
    overview,
    /import \{ useOpsOverlay \} from '@\/components\/ops\/shell\/use-ops-overlay'/,
  );
  assert.match(overview, /const overlayActive = !isDesktop && overlayOpen/);
  assert.match(
    overview,
    /const overlayMounted = overlayActive && detailPortalTarget != null/,
  );
  assert.match(
    overview,
    /useOpsOverlay\(\{[\s\S]*open: overlayMounted,[\s\S]*returnFocusRef: lastTrigger/,
  );
  assert.match(overview, /initialFocusSelector: '#queue-inspector-heading'/);
  assert.match(overview, /lastTrigger\.current = trigger/);
  assert.match(
    overview,
    /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-label=\{`\$\{selectedQueue\?\.label/,
  );
  assert.match(
    overview,
    /className=\{styles\.overlayScrim\}[\s\S]*tabIndex=\{-1\}[\s\S]*aria-hidden="true"/,
  );
  assert.doesNotMatch(overview, /document\.body\.style\.overflow/);
  assert.doesNotMatch(overview, /window\.addEventListener\('keydown'/);
});

test("queue inspectors use the shared overlay contract and inert every shell plane", async () => {
  const [inbox, hook] = await Promise.all([
    readSource("components/ops/inbox/InboxContainer.tsx"),
    readSource("components/ops/shell/use-ops-overlay.ts"),
  ]);

  assert.match(
    inbox,
    /import \{[\s\S]*OPS_OVERLAY_INERT_TARGETS,[\s\S]*useOpsOverlay/,
  );
  assert.match(
    inbox,
    /const overlayMounted\s*=\s*[\s\S]*?usesOverlayInspector[\s\S]*?detailPortalTarget != null/,
  );
  assert.match(
    inbox,
    /useOpsOverlay\(\{[\s\S]*open: overlayMounted,[\s\S]*returnFocusRef: lastTriggerRef/,
  );
  assert.match(inbox, /inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS/);
  assert.match(inbox, /initialFocusSelector: ["']\[data-ops-inspector-close\]["']/);
  assert.match(inbox, /data-ops-inspector-close/);
  assert.doesNotMatch(inbox, /document\.body\.style\.overflow/);
  assert.doesNotMatch(inbox, /handleOverlayKeyDown/);

  assert.match(hook, /'\[data-ops-workspace\]'/);
  assert.match(hook, /'\[data-ops-sidebar-layer\]'/);
  assert.match(hook, /'\[data-ops-detail\]'/);
  assert.match(hook, /'\[data-ops-menu-fab\]'/);
});

test("Ops native dialogs preserve public defaults while owning the Ops scroll plane", async () => {
  const [modal, hook, operators, vocabulary, publicHeader] = await Promise.all([
    readSource("components/ui/use-modal-dialog.ts"),
    readSource("components/ops/shell/use-ops-overlay.ts"),
    readSource("app/(ops)/ops/operators/OperatorsDirectory.tsx"),
    readSource("app/(ops)/ops/vocabulary/VocabularyTargetPicker.tsx"),
    readSource("components/navigation/site-header.tsx"),
  ]);

  assert.match(
    hook,
    /OPS_MODAL_DIALOG_OPTIONS[\s\S]*scrollOwnerSelector: '\[data-ops-main\]'/,
  );
  assert.match(hook, /inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS/);
  assert.match(modal, /interface UseModalDialogOptions/);
  assert.match(
    modal,
    /document\.querySelector<HTMLElement>\(scrollOwnerSelector\)/,
  );
  assert.match(modal, /\?\? document\.body/);
  assert.match(modal, /!target\.contains\(element\)/);
  assert.match(modal, /target\.setAttribute\('inert', ''\)/);
  assert.match(
    modal,
    /if \(!environment\.previousInert\[index\]\) target\.removeAttribute\('inert'\)/,
  );
  assert.match(operators, /useModalDialog\(OPS_MODAL_DIALOG_OPTIONS\)/);
  assert.equal(
    (operators.match(/useModalDialog\(OPS_MODAL_DIALOG_OPTIONS\)/g) ?? [])
      .length,
    2,
  );
  assert.match(vocabulary, /useModalDialog\(OPS_MODAL_DIALOG_OPTIONS\)/);
  assert.match(publicHeader, /useModalDialog\(\)/);
});

test("Overview context is a touch bottom sheet, compact side sheet, and one-scroll-owner inspector", async () => {
  const [overviewCss, shellCss, chrome] = await Promise.all([
    readSource("app/(ops)/ops/overview.module.css"),
    readSource("components/ops/shell/ops-tablet.module.css"),
    readSource("components/ops/shell/OpsChrome.tsx"),
  ]);

  assert.doesNotMatch(
    overviewCss,
    /^\s*:global\(\[data-ops-(?:detail|workspace|main|sidebar)/m,
  );
  assert.doesNotMatch(
    shellCss,
    /^\s*:global\(\[data-ops-(?:shell|workspace|main|detail|sidebar)\][^)]*\)\s*\{/m,
  );
  assert.match(chrome, /className=\{`\$\{styles\.container\} \$\{adaptive\.shell\}`\}/);

  const touchStart = overviewCss.indexOf("@media (max-width: 819px)");
  const persistentShellStart = overviewCss.indexOf(
    "@media (min-width: 820px)",
    touchStart,
  );
  assert.ok(touchStart >= 0 && persistentShellStart > touchStart);
  const touchRules = overviewCss.slice(touchStart, persistentShellStart);

  assert.match(touchRules, /\.overlayStage\s*\{[\s\S]*align-items:\s*flex-end/);
  assert.match(
    touchRules,
    /\.overlayInspector\s*\{[\s\S]*height:\s*min\(76dvh,\s*680px\)/,
  );
  assert.match(
    touchRules,
    /border-radius:\s*var\(--ops-shell-radius\) var\(--ops-shell-radius\) 0 0/,
  );
  assert.match(touchRules, /animation-name:\s*inspectorUp/);

  assert.match(
    shellCss,
    /@media \(min-width: 820px\) and \(max-width: 1179px\)[\s\S]*?\.detailPane\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*var\(--ops-shell-inset\)/,
  );
  assert.match(
    overviewCss,
    /\.inspectorContent\s*\{[\s\S]*?overflow:\s*hidden/,
  );
  assert.match(overviewCss, /\.inspectorScroll\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test("route shell tuning stays locally owned across Ops navigation", async () => {
  const routes = ["observations", "vocabulary"];

  for (const route of routes) {
    const [page, loading, shellCss] = await Promise.all([
      readSource(`app/(ops)/ops/${route}/page.tsx`),
      readSource(`app/(ops)/ops/${route}/loading.tsx`),
      readSource(`app/(ops)/ops/${route}/${route}-shell.module.css`),
    ]);

    assert.match(page, /import shellStyles from ["'].+shell\.module\.css["']/);
    assert.match(loading, /import shellStyles from ["'].+shell\.module\.css["']/);
    assert.match(page, /className=\{shellStyles\.scope\}/);
    assert.match(loading, /className=\{shellStyles\.scope\}/);
    assert.match(shellCss, /\.scope\s*\{/);
    assert.match(shellCss, /:global\(\[data-ops-shell\]\):has\(\.scope\)/);
    const shellLines = shellCss.split("\n");
    shellLines.forEach((line, index) => {
      if (!/:global\(\[data-ops-(?:detail|workspace|main|sidebar)/.test(line)) return;
      assert.match(`${shellLines[index - 1] ?? ""} ${line}`, /:has\(\.scope\)/);
    });
  }
});
