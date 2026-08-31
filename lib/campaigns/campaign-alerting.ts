import "server-only";

import { createHash } from "node:crypto";
import {
  sendAlertEmail,
  hasTransactionalEmailConfig,
} from "@/lib/email/mailer";

type RejectedCandidate = {
  slug: string;
  blocker: string;
};

type NoCandidateAlertPayload = {
  event: string;
  severity: "warning" | "critical";
  message: string;
  checkedAt: string;
  rejectedCandidateCount: number;
  blockerBreakdown: Record<string, number>;
  topRejected: Array<{ slug: string; blocker: string }>;
  timestamp: string;
};

type CampaignExceptionAlertPayload = {
  failureCode: string;
  mode: "production";
  timestamp: string;
  message: string;
};

type CampaignExceptionAlertDependencies = {
  hasMailConfig: () => boolean;
  sendMail: typeof sendAlertEmail;
  logMailFailure: (alert: CampaignExceptionAlertPayload) => void;
  sendTimeoutMs: number;
};

const ALERT_RECIPIENT =
  process.env.CAMPAIGN_ALERT_EMAIL ??
  process.env.INVENTORY_ALERT_EMAIL ??
  "hello@jelocare.com";

const NO_CANDIDATE_CRITICAL_THRESHOLD = 120;
const CAMPAIGN_EXCEPTION_ALERT_TIMEOUT_MS = 5_000;

export function sanitizeCampaignFailureCode(value: unknown): string {
  if (value === "campaign-run-failed") return value;
  if (
    typeof value === "string" &&
    /^campaign-run-failed-[a-f0-9]{16}$/.test(value)
  ) {
    return value;
  }

  const digest = createHash("sha256")
    .update(typeof value === "string" ? value : "unknown-campaign-failure")
    .digest("hex")
    .slice(0, 16);

  return `campaign-run-failed-${digest}`;
}

function exceptionAlertEmailHtml(alert: CampaignExceptionAlertPayload): string {
  return `<table style="border-collapse:collapse;font-family:monospace;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Failure code</td><td style="padding:4px 0">${alert.failureCode}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Mode</td><td style="padding:4px 0">${alert.mode}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Timestamp</td><td style="padding:4px 0">${alert.timestamp}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Message</td><td style="padding:4px 0">${alert.message}</td></tr>
  </table>`;
}

const defaultExceptionAlertDependencies: CampaignExceptionAlertDependencies = {
  hasMailConfig: hasTransactionalEmailConfig,
  sendMail: sendAlertEmail,
  logMailFailure: (alert) => {
    console.error(
      JSON.stringify({
        event: "daily_campaign_exception_alert_email_failed",
        ...alert,
      }),
    );
  },
  sendTimeoutMs: CAMPAIGN_EXCEPTION_ALERT_TIMEOUT_MS,
};

/**
 * Send the production exception alert without exposing the underlying error.
 *
 * The mail and its failure log contain only a bounded failure code and generic
 * operational context. Provider failures are deliberately absorbed so the
 * cron route can preserve its original response.
 */
export async function sendCampaignExceptionAlert(
  failureCode: unknown,
  timestamp: string,
  dependencies: CampaignExceptionAlertDependencies = defaultExceptionAlertDependencies,
): Promise<CampaignExceptionAlertPayload> {
  const alert: CampaignExceptionAlertPayload = {
    failureCode: sanitizeCampaignFailureCode(failureCode),
    mode: "production",
    timestamp: new Date(timestamp).toISOString(),
    message:
      "The production daily campaign run failed. Review the structured server logs using the failure code.",
  };

  if (!dependencies.hasMailConfig()) return alert;

  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      dependencies.sendMail({
        to: ALERT_RECIPIENT,
        subject: "[JeloCare CRITICAL] Daily campaign run failed",
        text: `${alert.message}\n\nFailure code: ${alert.failureCode}\nMode: ${alert.mode}\nTimestamp: ${alert.timestamp}`,
        html: exceptionAlertEmailHtml(alert),
      }),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error("campaign-exception-alert-timeout")),
          dependencies.sendTimeoutMs,
        );
      }),
    ]);
  } catch {
    dependencies.logMailFailure(alert);
  } finally {
    if (deadline) clearTimeout(deadline);
  }

  return alert;
}

/**
 * Determine whether a no-candidate campaign run should trigger an alert.
 *
 * A single no-candidate day is a warning — it can happen when all eligible
 * products are in cooldown. A large rejection count suggests a systemic
 * issue (e.g., brand-alias drift, all offers expired, evidence pipeline
 * broken) and is escalated to critical.
 */
function shouldAlert(
  checkedAt: string,
  rejectedCandidates: readonly RejectedCandidate[],
): NoCandidateAlertPayload | undefined {
  const blockerBreakdown: Record<string, number> = {};
  for (const candidate of rejectedCandidates) {
    blockerBreakdown[candidate.blocker] =
      (blockerBreakdown[candidate.blocker] ?? 0) + 1;
  }

  const severity =
    rejectedCandidates.length >= NO_CANDIDATE_CRITICAL_THRESHOLD
      ? "critical"
      : "warning";

  const topRejected = rejectedCandidates.slice(0, 20);

  return {
    event: "daily_campaign_no_candidate",
    severity,
    message:
      rejectedCandidates.length === 0
        ? "Daily campaign found no eligible candidate and the ranked pool was empty."
        : `Daily campaign found no eligible candidate. ${rejectedCandidates.length} products were rejected.`,
    checkedAt,
    rejectedCandidateCount: rejectedCandidates.length,
    blockerBreakdown,
    topRejected,
    timestamp: new Date().toISOString(),
  };
}

function alertEmailHtml(alert: NoCandidateAlertPayload): string {
  const breakdownRows = Object.entries(alert.blockerBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([blocker, count]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${blocker}</td><td style="padding:4px 0">${count}</td></tr>`,
    )
    .join("");

  const topRejectedRows = alert.topRejected
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${c.slug}</td><td style="padding:4px 0">${c.blocker}</td></tr>`,
    )
    .join("");

  return `<table style="border-collapse:collapse;font-family:monospace;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Event</td><td style="padding:4px 0">${alert.event}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Severity</td><td style="padding:4px 0">${alert.severity}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Message</td><td style="padding:4px 0">${alert.message}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Checked at</td><td style="padding:4px 0">${alert.checkedAt}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Rejected</td><td style="padding:4px 0">${alert.rejectedCandidateCount}</td></tr>
  </table>
  <h3 style="font-family:monospace;font-size:14px;margin-top:16px">Blocker breakdown</h3>
  <table style="border-collapse:collapse;font-family:monospace;font-size:14px">
    ${breakdownRows}
  </table>
  ${
    topRejectedRows
      ? `<h3 style="font-family:monospace;font-size:14px;margin-top:16px">Top rejected (first 20)</h3>
  <table style="border-collapse:collapse;font-family:monospace;font-size:14px">
    ${topRejectedRows}
  </table>`
      : ""
  }`;
}

/**
 * Send an alert if the daily campaign run produced no candidate.
 *
 * This closes the silence gap where a no-candidate day is indistinguishable
 * from "nothing to send" versus "the pipeline is broken." The alert includes
 * a blocker breakdown so operators can see whether rejections are cooldown
 * (expected), evidence drift (systemic), or offer staleness (actionable).
 */
export async function sendCampaignNoCandidateAlertIfNeeded(
  checkedAt: string,
  rejectedCandidates: readonly RejectedCandidate[],
): Promise<NoCandidateAlertPayload | undefined> {
  const alert = shouldAlert(checkedAt, rejectedCandidates);
  if (!alert) return undefined;

  console.warn(JSON.stringify(alert));

  if (hasTransactionalEmailConfig()) {
    try {
      await sendAlertEmail({
        to: ALERT_RECIPIENT,
        subject: `[JeloCare ${alert.severity.toUpperCase()}] ${alert.event}`,
        text: `${alert.message}\n\nBlocker breakdown: ${JSON.stringify(alert.blockerBreakdown, null, 2)}\n\nTop rejected: ${JSON.stringify(alert.topRejected, null, 2)}`,
        html: alertEmailHtml(alert),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "campaign_alert_email_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return alert;
}

export type {
  CampaignExceptionAlertDependencies,
  CampaignExceptionAlertPayload,
  NoCandidateAlertPayload,
  RejectedCandidate as CampaignRejectedCandidate,
};
