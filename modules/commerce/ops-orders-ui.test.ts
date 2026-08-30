import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveOrderQueueSelection } from "../../app/(ops)/ops/orders/order-selection";

const root = process.cwd();

function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("Ops orders keep selection in the URL and render detail through the shell pane", async () => {
  const queue = await source("app/(ops)/ops/orders/OrdersQueue.tsx");

  assert.match(queue, /useUrlInboxSelection\(\)/);
  assert.match(queue, /selectOrderId\(order\)/);
  assert.match(queue, /data-order-id=\{order\.id\}/);
  assert.match(queue, /aria-pressed=\{order\.id === selectedId\}/);
  assert.match(queue, /aria-busy=\{pendingSelectionId === order\.id/);
  assert.match(queue, /document\.getElementById\(["']ops-detail-pane["']\)/);
  assert.match(queue, /createPortal\(inspector, detailPortalTarget\)/);
  assert.match(queue, /data-ops-reserve-detail/);
  assert.match(queue, /if \(!selectionMissing\) return/);
  assert.match(
    queue,
    /document\.querySelector<HTMLElement>\(["']\[data-ops-main\]["']\)/,
  );
  assert.match(queue, /lastTriggerRef\.current\?\.isConnected/);
  assert.match(queue, /returnFocusFallbackSelector: ["']\[data-ops-main\]["']/);
});

test("order selection survives category moves and never substitutes a vanished order", () => {
  const waiting = [{ id: "order-a" }, { id: "order-b" }];
  assert.deepEqual(resolveOrderQueueSelection(waiting, null), {
    selected: null,
    selectionMissing: false,
  });
  assert.deepEqual(resolveOrderQueueSelection(waiting, "order-a"), {
    selected: waiting[0],
    selectionMissing: false,
  });

  const moved = [waiting[1], waiting[0]];
  assert.deepEqual(resolveOrderQueueSelection(moved, "order-a"), {
    selected: waiting[0],
    selectionMissing: false,
  });

  assert.deepEqual(resolveOrderQueueSelection([waiting[1]], "order-a"), {
    selected: null,
    selectionMissing: true,
  });
});

test("touch Orders detail uses the shared modal behavior and restores its exact trigger", async () => {
  const queue = await source("app/(ops)/ops/orders/OrdersQueue.tsx");

  assert.match(queue, /lastTriggerRef\.current = trigger/);
  assert.match(
    queue,
    /useOpsOverlay\(\{[\s\S]*open: overlayMounted,[\s\S]*returnFocusRef: lastTriggerRef/,
  );
  assert.match(queue, /inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS/);
  assert.match(
    queue,
    /initialFocusSelector: ["']\[data-ops-inspector-close\]["']/,
  );
  assert.match(queue, /role=["']dialog["']/);
  assert.match(queue, /aria-modal=["']true["']/);
  assert.match(queue, /data-ops-inspector-close/);
  assert.match(
    queue,
    /className=\{styles\.overlayScrim\}[\s\S]*onClick=\{closeInspector\}/,
  );
  assert.doesNotMatch(queue, /window\.addEventListener\(["']keydown/);
  assert.doesNotMatch(queue, /document\.body\.style\.overflow/);
});

test("Orders timestamps are hydration-stable and line count is grammatical", async () => {
  const queue = await source("app/(ops)/ops/orders/OrdersQueue.tsx");

  assert.match(
    queue,
    /import \{ formatOrderDateTime \} from ["']@\/lib\/commerce\/order-date["']/,
  );
  assert.doesNotMatch(queue, /new Intl\.DateTimeFormat/);
  assert.doesNotMatch(queue, /\bdate\.format\(/);
  assert.match(queue, /formatOrderDateTime\(order\.updatedAt\)/);
  assert.match(
    queue,
    /order\.lines\.length === 1 \? ["']line["'] : ["']lines["']/,
  );
});

test("Orders open a calm summary before mounting one focused current action", async () => {
  const queue = await source("app/(ops)/ops/orders/OrdersQueue.tsx");
  const summaryStart = queue.indexOf("{!actionMode ? (");
  const actionStart = queue.indexOf("{actionWasOpened && canManage ? (");

  assert.ok(summaryStart >= 0 && actionStart > summaryStart);
  const summary = queue.slice(summaryStart, actionStart);
  assert.doesNotMatch(
    summary,
    /<QuoteForm|<PaymentVerification|<LifecycleDecisionForm/,
  );
  assert.match(summary, /<PaymentOverview order=\{selected\}/);
  assert.match(summary, /<OrderOverviewWarnings/);
  assert.match(
    summary,
    /<details[\s\S]*?className=\{styles\.secondarySignals\}>/,
  );
  assert.match(summary, /ref=\{actionTriggerRef\}/);
  assert.match(summary, /onClick=\{openCurrentAction\}/);

  assert.match(
    queue,
    /const \[openedActionKey, setOpenedActionKey\] = useState<string \| null>\(null\)/,
  );
  assert.match(
    queue,
    /`\$\{selected\.id\}:\$\{selected\.state\}:\$\{selected\.revision\}`/,
  );
  assert.match(
    queue,
    /className=\{styles\.actionView\} hidden=\{!actionMode\}/,
  );
  assert.match(queue, /> Back to order/);
  assert.match(queue, /actionTriggerRef\.current\?\.focus/);
  assert.match(queue, /recoveryTriggerRef\.current\?\.focus/);
  assert.match(queue, /actionRecoveryRef\.current\?\.focus/);
  assert.match(queue, /actionHeadingRef\.current\?\.focus/);
  assert.match(queue, /setRecoveryModeKey\(null\)/);
  assert.match(queue, /data-ops-order-overlay-scroll/);
  assert.match(queue, /scrollOwner\?\.scrollTo\(\{ top: 0, left: 0 \}\)/);

  const actionResolver = queue.slice(
    queue.indexOf("function resolveCurrentOrderAction"),
    queue.indexOf("function isPrePaymentCancellationState"),
  );
  assert.doesNotMatch(actionResolver, /awaiting_approval/);
  assert.match(
    queue,
    /onClick=\{\(event\) => openRecoveryAction\(event\.currentTarget\)\}/,
  );
});

test("Orders keep critical payment truth visible while the manual form is closed", async () => {
  const queue = await source("app/(ops)/ops/orders/OrdersQueue.tsx");

  assert.match(queue, /function PaymentOverview/);
  assert.match(queue, /Approved total/);
  assert.match(queue, /order\.quote\?\.totalNgn/);
  assert.match(queue, /Provider evidence needs review/);
  assert.match(queue, /paymentReview\.reason/);
  assert.match(
    queue,
    /\{actionWasOpened && canManage \? \([\s\S]*?<PaymentVerification/,
  );
});

test("Orders inspector is a one-scroll-owner bottom sheet with reachable actions", async () => {
  const styles = await source("app/(ops)/ops/orders/orders.module.css");

  const touchStart = styles.indexOf("@media (max-width: 819px)");
  const narrowStart = styles.indexOf("@media (max-width: 720px)", touchStart);
  assert.ok(touchStart >= 0 && narrowStart > touchStart);
  const touchRules = styles.slice(touchStart, narrowStart);

  assert.match(touchRules, /\.overlayStage\s*\{[\s\S]*align-items:\s*flex-end/);
  assert.match(
    touchRules,
    /\.overlaySheet\s*\{[\s\S]*height:\s*min\(88dvh, 760px\)/,
  );
  assert.match(
    touchRules,
    /border-radius:\s*var\(--ops-shell-radius\) var\(--ops-shell-radius\) 0 0/,
  );
  assert.match(styles, /\.overlaySheet\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.overlayBody\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(
    touchRules,
    /padding-bottom:\s*calc\(56px \+ var\(--space-6\) \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(
    styles,
    /width:\s*var\(--touch-min\);[\s\S]*height:\s*var\(--touch-min\);/,
  );
  assert.match(
    styles,
    /var\(--ops-action-subtle, var\(--ops-accent-subtle\)\)/,
  );
  assert.match(
    styles,
    /background:\s*var\(--ops-action, var\(--ops-accent\)\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?\.currentAction\s*\{[\s\S]*?flex-direction:\s*column/,
  );
  assert.match(
    styles,
    /\.inspector > header > span\s*\{[\s\S]*?background:\s*var\(--ops-accent-subtle\);[\s\S]*?color:\s*var\(--ops-accent\);/,
  );
  assert.doesNotMatch(
    styles.match(/\.inspector > header > span\s*\{[\s\S]*?\}/)?.[0] ?? "",
    /--ops-action/,
  );

  const shellStyles = await source(
    "components/ops/shell/ops-tablet.module.css",
  );
  assert.match(
    shellStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.refreshIconPending\s*\{\s*animation:\s*none;/,
  );
});
