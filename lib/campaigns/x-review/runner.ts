import "server-only";
import { randomUUID } from "node:crypto";
import { campaignRecipientKey } from "@/lib/campaigns/campaign-archive";
import {
  hasTransactionalEmailConfig,
  sendAlertEmail,
} from "@/lib/email/mailer";
import { readXReviewBatch } from "./client";
import { draftXReview } from "./draft";
import {
  renderXReviewEmail,
  reportHash,
  reviewItem,
  xReviewConfig,
  type XReviewReport,
} from "./report";
import { xReviewStore } from "./store";

export const defaultXReviewDependencies = {
  store: xReviewStore,
  read: readXReviewBatch,
  draft: draftXReview,
  recipientKey: campaignRecipientKey,
  hasMail: hasTransactionalEmailConfig,
  send: sendAlertEmail,
  uuid: randomUUID,
};
type Dependencies = typeof defaultXReviewDependencies;

export async function prepareXReview(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
  deps: Dependencies = defaultXReviewDependencies,
) {
  const config = xReviewConfig(env, now);
  if (!config) return { status: "disabled" as const };
  const recipientKey = deps.recipientKey(config.recipient, env);
  if (!(await deps.store.reserveRun(now)))
    return { status: "allowance-or-window-exhausted" as const };
  const batch = await deps.read({ bearerToken: config.token, now });
  const items = [];
  for (const post of batch.posts) {
    if (
      post.authorId === batch.accountId ||
      (await deps.store.wasReported(post.id))
    )
      continue;
    const item = reviewItem(post);
    if (item) items.push(item);
  }
  const drafted = config.aiEnabled
    ? await deps.draft(items)
    : { items, aiStatus: "disabled" as const, aiCostUsd: null };
  const report: XReviewReport = {
    id: `x-review-${deps.uuid()}`,
    checkedAt: now.toISOString(),
    recipientKey,
    items: drafted.items,
    moreAvailable: batch.moreAvailable,
    aiStatus: drafted.aiStatus,
    aiCostUsd: drafted.aiCostUsd,
  };
  await deps.store.save(report);
  return {
    status: "preview-ready" as const,
    reportId: report.id,
    sha256: reportHash(report),
    itemCount: report.items.length,
    email: renderXReviewEmail(report),
  };
}

export async function sendXReviewPreview(
  input: { reportId: string; sha256: string },
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
  deps: Dependencies = defaultXReviewDependencies,
) {
  const config = xReviewConfig(env, now);
  if (!config?.emailEnabled) return { status: "email-disabled" as const };
  if (!deps.hasMail()) throw new Error("x-review-mail-unavailable");
  const report = await deps.store.load(input.reportId);
  if (
    !report ||
    reportHash(report) !== input.sha256 ||
    report.recipientKey !== deps.recipientKey(config.recipient, env)
  )
    throw new Error("x-review-preview-mismatch");
  const age = now.valueOf() - Date.parse(report.checkedAt);
  if (!Number.isFinite(age) || age < 0 || age > 3_600_000)
    throw new Error("x-review-preview-expired");
  if (!report.items.length) return { status: "no-actionable-items" as const };
  if (!(await deps.store.reserveDelivery(report)))
    return { status: "duplicate-suppressed" as const };
  try {
    await deps.send({ to: config.recipient, ...renderXReviewEmail(report) });
  } catch {
    await deps.store.deliveryOutcome(report, "failed");
    throw new Error("x-review-delivery-uncertain-no-retry");
  }
  await deps.store.deliveryOutcome(report, "accepted");
  return { status: "provider-accepted" as const, reportId: report.id };
}
