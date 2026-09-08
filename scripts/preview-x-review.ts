import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  renderXReviewEmail,
  type XReviewReport,
} from "@/lib/campaigns/x-review/report";

// Offline layout fixture only. No environment reads, API calls, AI calls or email.
const report: XReviewReport = {
  id: "x-review-11111111-1111-4111-8111-111111111111",
  checkedAt: "2026-09-07T07:00:00.000Z",
  recipientKey: "fixture-only",
  aiStatus: "disabled",
  aiCostUsd: null,
  moreAvailable: true,
  items: [
    {
      classification: "light banter",
      reason:
        "Illustrative copy only — not a real X interaction or a generated result.",
      draft: "Delivery fee wanted its own introduction 😭",
      source: {
        id: "1",
        authorId: "2",
        username: "example_only",
        createdAt: "2026-09-07T06:55:00.000Z",
        text: "I checked the basket total. Delivery fee came to introduce itself afterwards.",
        parent: {
          id: "3",
          authorId: "4",
          username: "jelocare",
          text: "Check the full total before checkout.",
        },
        metrics: { replies: 0, reposts: 0, likes: 0, views: null },
        hasMedia: false,
        sensitive: false,
      },
    },
    {
      classification: "care/safety response",
      reason:
        "Care concern: human review required. No AI draft or clinical inference.",
      draft: null,
      source: {
        id: "5",
        authorId: "6",
        username: "example_only",
        createdAt: "2026-09-07T06:45:00.000Z",
        text: "Text withheld from email and AI; review the public source privately.",
        parent: null,
        metrics: { replies: 0, reposts: 0, likes: 0, views: null },
        hasMedia: false,
        sensitive: false,
      },
    },
  ],
};
const email = renderXReviewEmail(report);
const html = email.html
  .replace(/href="https:\/\/x.com\/i\/status\/\d+"/g, 'href="#layout-only"')
  .replace(
    "<table role=",
    '<div style="padding:12px 20px;background:#21171b;color:#fff7f4;text-align:center;font:14px Arial">LAYOUT SAMPLE — fictional content; not sent; source links disabled.</div><table role=',
  );
async function main() {
  const directory = await mkdtemp(join(tmpdir(), "jelocare-x-review-preview-"));
  const path = join(directory, "email-preview.html");
  await writeFile(path, html, { flag: "wx" });
  console.log(path);
}
void main();
