import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monitorSource = readFileSync(
  new URL(
    "../../app/(ops)/ops/market-health/MarketHealthMonitor.tsx",
    import.meta.url,
  ),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../../app/(ops)/ops/market-health/page.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL(
    "../../app/(ops)/ops/market-health/market-health.module.css",
    import.meta.url,
  ),
  "utf8",
);
const chromeSource = readFileSync(
  new URL("../../components/ops/shell/OpsChrome.tsx", import.meta.url),
  "utf8",
);
const overviewSource = readFileSync(
  new URL("../../app/(ops)/ops/OverviewBriefing.tsx", import.meta.url),
  "utf8",
);

test("market health is a private read-only monitor in the native Ops shell", () => {
  assert.match(pageSource, /requireConsoleOperator\(\)/);
  assert.match(pageSource, /OpsWorkspace title=["']Market health["']/);
  assert.doesNotMatch(
    monitorSource,
    /<button|formAction|useActionState|server action/i,
  );
  assert.match(chromeSource, /href: ["']\/ops\/market-health["']/);
  assert.match(chromeSource, /label: ["']Market health["']/);
});

test("the monitor preserves one vertical chain and progressive disclosure", () => {
  assert.match(monitorSource, /<ol className=\{styles\.chain\}>/);
  assert.match(monitorSource, /<details className=\{styles\.disclosure\}>/);
  assert.match(monitorSource, /Threshold/);
  assert.match(monitorSource, /Owner/);
  assert.match(monitorSource, /Runbook/);
  assert.doesNotMatch(cssSource, /grid-template-columns:\s*repeat\(3/);
  assert.doesNotMatch(cssSource, /backdrop-filter|box-shadow/);
});

test("monitor copy keeps implementation data secondary", () => {
  assert.doesNotMatch(monitorSource, /UUID|SQL|Redis|Postgres|payload/i);
  assert.match(monitorSource, /<summary>Receipt<\/summary>/);
  assert.match(monitorSource, /className=\{styles\.revision\}/);
  assert.match(monitorSource, /Observed <RelativeTime/);
});

test("Overview discloses the response contract for actionable exceptions", () => {
  assert.match(overviewSource, /Observed <RelativeTime/);
  assert.match(overviewSource, /<dt>Owner<\/dt>/);
  assert.match(overviewSource, /<dt>Threshold<\/dt>/);
  assert.match(overviewSource, /<dt>Runbook<\/dt>/);
  assert.match(overviewSource, /href=\{item\.actionHref\}/);
});
