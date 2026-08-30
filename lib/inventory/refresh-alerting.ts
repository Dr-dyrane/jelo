import {
  sendAlertEmail,
  hasTransactionalEmailConfig,
} from "@/lib/email/mailer";
import type { InventoryRefreshFailureReason } from "@/lib/inventory/refresh-policy";

type RefreshRunSummary = {
  queued: number;
  withdrawn: number;
  processed: number;
  completed: number;
  retrying: number;
  deferred: number;
  failed: number;
  discarded: number;
  recoveredLeases: number;
  failureReasons: Partial<Record<InventoryRefreshFailureReason, number>>;
  stoppedByDeadline: boolean;
  affectedProductSlugs: string[];
};

type BacklogSummary = {
  active: number;
  queued: number;
  due: number;
  processing: number;
  leaseExpired: number;
  oldestDueAt: Date | null;
  staleOffers?: number;
};

type AlertPayload = {
  event: string;
  severity: "warning" | "critical";
  message: string;
  run?: RefreshRunSummary;
  backlog?: BacklogSummary;
  timestamp: string;
};

const BACKLOG_ALERT_THRESHOLD = 50;
const DEFERRED_ALERT_THRESHOLD = 5;
const STALE_OFFER_ALERT_THRESHOLD = 30;
const ALERT_RECIPIENT =
  process.env.INVENTORY_ALERT_EMAIL ?? "hello@jelocare.com";

function shouldAlert(
  run: RefreshRunSummary,
  backlog: BacklogSummary,
): AlertPayload | undefined {
  if (run.deferred >= DEFERRED_ALERT_THRESHOLD) {
    return {
      event: "inventory_refresh_deferred_rechecks",
      severity: "critical",
      message: `${run.deferred} offers were fail-closed and deferred to bounded daily rechecks in the last cron run.`,
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  if (run.failed >= DEFERRED_ALERT_THRESHOLD) {
    return {
      event: "inventory_refresh_failed_offers",
      severity: "critical",
      message: `${run.failed} offers could not be placed on a safe recheck path in the last cron run.`,
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  if (run.completed === 0 && run.processed > 0) {
    return {
      event: "inventory_refresh_zero_completions",
      severity: "critical",
      message: "No offers were successfully refreshed in the last cron run.",
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  if (backlog.due > BACKLOG_ALERT_THRESHOLD) {
    return {
      event: "inventory_refresh_backlog_growing",
      severity: "warning",
      message: `${backlog.due} offers are due for refresh — the cron is falling behind.`,
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  if ((backlog.staleOffers ?? 0) > STALE_OFFER_ALERT_THRESHOLD) {
    return {
      event: "inventory_stale_offers_accumulating",
      severity: "warning",
      message: `${backlog.staleOffers} exact NG offers have expired verification with no active refresh — prices may be outdated.`,
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  return undefined;
}

function alertEmailHtml(alert: AlertPayload): string {
  const rows = [
    ["Event", alert.event],
    ["Severity", alert.severity],
    ["Message", alert.message],
    ["Timestamp", alert.timestamp],
  ];
  if (alert.run) {
    rows.push(
      ["Processed", String(alert.run.processed)],
      ["Completed", String(alert.run.completed)],
      ["Failed", String(alert.run.failed)],
      ["Retrying", String(alert.run.retrying)],
      ["Deferred", String(alert.run.deferred)],
      ["Discarded", String(alert.run.discarded)],
      ["Failure reasons", JSON.stringify(alert.run.failureReasons)],
      ["Stopped by deadline", String(alert.run.stoppedByDeadline)],
    );
  }
  if (alert.backlog) {
    rows.push(
      ["Backlog — due", String(alert.backlog.due)],
      ["Backlog — queued", String(alert.backlog.queued)],
      ["Backlog — processing", String(alert.backlog.processing)],
      ["Backlog — lease expired", String(alert.backlog.leaseExpired)],
      ["Stale offers", String(alert.backlog.staleOffers ?? "n/a")],
    );
  }
  return `<table style="border-collapse:collapse;font-family:monospace;font-size:14px">
    ${rows.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${label}</td><td style="padding:4px 0">${value}</td></tr>`).join("")}
  </table>`;
}

export async function sendRefreshAlertIfNeeded(
  run: RefreshRunSummary,
  backlog: BacklogSummary,
): Promise<AlertPayload | undefined> {
  const alert = shouldAlert(run, backlog);
  if (!alert) return undefined;

  console.warn(JSON.stringify(alert));

  if (hasTransactionalEmailConfig()) {
    try {
      await sendAlertEmail({
        to: ALERT_RECIPIENT,
        subject: `[JeloCare ${alert.severity.toUpperCase()}] ${alert.event}`,
        text: `${alert.message}\n\n${JSON.stringify({ run: alert.run, backlog: alert.backlog }, null, 2)}`,
        html: alertEmailHtml(alert),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "inventory_alert_email_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return alert;
}

export type { AlertPayload, RefreshRunSummary, BacklogSummary };
