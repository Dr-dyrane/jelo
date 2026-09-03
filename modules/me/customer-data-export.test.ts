import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("customer data export is owner-derived, private, and includes active Concerns", () => {
  const route = readFileSync("app/(customer)/me/shelf/export/route.ts", "utf8");

  assert.match(route, /const customer = await requireCustomer\(\)/);
  assert.match(route, /customerShelfService\.read\(customer\)/);
  assert.match(route, /customerConcernService\.read\(customer\)/);
  assert.match(route, /shelfRead\.status === ['"]unavailable['"]/);
  assert.match(route, /concernRead\.status === ['"]unavailable['"]/);
  assert.match(route, /format: ['"]jelocare-customer-data-export-v1['"]/);
  assert.match(route, /slug: concern\.concernSlug/);
  assert.match(route, /savedAt: concern\.savedAt/);
  assert.match(route, /source: concern\.origin/);
  assert.match(route, /private, no-store/);
  assert.match(route, /attachment; filename=[^\n]*jelocare-data\.json/);
  assert.doesNotMatch(route, /ownerSubject|owner_subject|customer\.email/);
});

test("account sheet offers one truthful Shelf-and-Concerns export", () => {
  const sheet = readFileSync(
    "components/me/shell/me-account-sheet.tsx",
    "utf8",
  );

  assert.match(sheet, /id="me-data-export-title">My data/);
  assert.match(sheet, /Shelf and saved concerns/);
  assert.match(sheet, /shelfAvailable && concernsAvailable/);
  assert.match(sheet, /href="\/me\/shelf\/export"/);
  assert.equal(sheet.match(/Export my data/g)?.length, 3);
  assert.match(sheet, /jelocare-preview-data\.json/);
  assert.match(sheet, /concerns: concerns\.map/);
  assert.doesNotMatch(sheet, /Export Shelf/);
});
