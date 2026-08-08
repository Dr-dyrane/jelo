import type { InventoryRefreshRunStatus } from '@/lib/inventory/refresh-policy';

type RefreshRunSummary = {
  queued: number;
  withdrawn: number;
  processed: number;
  completed: number;
  retrying: number;
  failed: number;
  discarded: number;
  recoveredLeases: number;
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
};

type AlertPayload = {
  event: string;
  severity: 'warning' | 'critical';
  message: string;
  run?: RefreshRunSummary;
  backlog?: BacklogSummary;
  timestamp: string;
};

const BACKLOG_ALERT_THRESHOLD = 50;
const FAILED_ALERT_THRESHOLD = 5;

function shouldAlert(run: RefreshRunSummary, backlog: BacklogSummary): AlertPayload | undefined {
  if (run.failed >= FAILED_ALERT_THRESHOLD) {
    return {
      event: 'inventory_refresh_failed_offers',
      severity: 'critical',
      message: `${run.failed} offers failed all retry attempts in the last cron run.`,
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  if (run.completed === 0 && run.processed > 0) {
    return {
      event: 'inventory_refresh_zero_completions',
      severity: 'critical',
      message: 'No offers were successfully refreshed in the last cron run.',
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  if (backlog.due > BACKLOG_ALERT_THRESHOLD) {
    return {
      event: 'inventory_refresh_backlog_growing',
      severity: 'warning',
      message: `${backlog.due} offers are due for refresh — the cron is falling behind.`,
      run,
      backlog,
      timestamp: new Date().toISOString(),
    };
  }

  return undefined;
}

export async function sendRefreshAlertIfNeeded(
  run: RefreshRunSummary,
  backlog: BacklogSummary,
): Promise<AlertPayload | undefined> {
  const alert = shouldAlert(run, backlog);
  if (!alert) return undefined;

  const webhookUrl = process.env.INVENTORY_ALERT_WEBHOOK;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'inventory_alert_delivery_failed',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  console.warn(JSON.stringify(alert));
  return alert;
}

export type { AlertPayload, RefreshRunSummary, BacklogSummary };
