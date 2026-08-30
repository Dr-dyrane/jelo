import postgres from "postgres";
import {
  APPLICATION_RUNTIME_ROLE,
  applicationDatabaseUrl,
  isProductionApplicationRuntime,
} from "@/lib/database/runtime-database-config";
import { INVENTORY_DEFERRED_RECHECK_ERROR_CODE } from "@/lib/inventory/refresh-policy";
import { isAuthorizedCronRequest } from "@/modules/retail-intelligence/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MISSED_ACTIVITY_MINUTES = 90;
const STALE_OFFER_THRESHOLD = 30;
const DEFERRED_RECHECK_THRESHOLD = 5;

type InventoryHealthRow = {
  last_job_activity_at: Date | null;
  recent_completed: number;
  recent_failed: number;
  recent_deferred: number;
  queued: number;
  due: number;
  processing: number;
  lease_expired: number;
  deferred: number;
  stale_offers: number;
};

function ageInMinutes(value: Date | null, now: number) {
  if (!value) return null;
  return Math.max(0, Math.floor((now - value.valueOf()) / 60_000));
}

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = applicationDatabaseUrl(process.env);
  if (!connectionString) {
    console.error(
      JSON.stringify({
        event: "inventory_health_watchdog_failed",
        reason: "runtime_database_unavailable",
      }),
    );
    return Response.json(
      { error: "Inventory health is unavailable." },
      { status: 500 },
    );
  }

  const sql = postgres(connectionString, {
    ...(isProductionApplicationRuntime(process.env)
      ? { user: APPLICATION_RUNTIME_ROLE }
      : {}),
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
  });

  try {
    const deferredErrorPrefix = `${INVENTORY_DEFERRED_RECHECK_ERROR_CODE}:`;
    const [row] = await sql<InventoryHealthRow[]>`
      with job_health as (
        select
          max(updated_at) as last_job_activity_at,
          count(*) filter (
            where status = 'completed'
              and completed_at >= now() - interval '90 minutes'
          )::int as recent_completed,
          count(*) filter (
            where status = 'failed'
              and completed_at >= now() - interval '90 minutes'
          )::int as recent_failed,
          count(*) filter (
            where status = 'queued'
              and left(last_error, char_length(${deferredErrorPrefix})) = ${deferredErrorPrefix}
              and next_attempt_at > now()
              and updated_at >= now() - interval '90 minutes'
          )::int as recent_deferred,
          count(*) filter (where status = 'queued')::int as queued,
          count(*) filter (
            where status = 'queued' and next_attempt_at <= now()
          )::int as due,
          count(*) filter (where status = 'processing')::int as processing,
          count(*) filter (
            where status = 'processing'
              and (
                started_at is null
                or started_at <= now() - interval '2 minutes'
              )
          )::int as lease_expired,
          count(*) filter (
            where status = 'queued'
              and left(last_error, char_length(${deferredErrorPrefix})) = ${deferredErrorPrefix}
              and next_attempt_at > now()
          )::int as deferred
        from inventory_refresh_jobs
      ), offer_health as (
        select count(*)::int as stale_offers
        from offers o
        join products p on p.id = o.product_id
        where p.is_published = true
          and o.match_kind = 'exact'
          and o.market_code = 'NG'
          and o.url ~* '^https://'
          and (
            o.verification_expires_at is null
            or o.verification_expires_at <= now()
          )
          and not exists (
            select 1
            from inventory_refresh_jobs j
            where j.offer_id = o.id
              and j.status in ('queued', 'processing')
          )
      )
      select job_health.*, offer_health.stale_offers
      from job_health
      cross join offer_health
    `;

    if (!row) throw new Error("Inventory health query returned no row.");

    const now = Date.now();
    const activityAgeMinutes = ageInMinutes(row.last_job_activity_at, now);
    const missed =
      row.due > 0 &&
      (activityAgeMinutes == null ||
        activityAgeMinutes > MISSED_ACTIVITY_MINUTES);
    const degraded =
      missed ||
      row.stale_offers > STALE_OFFER_THRESHOLD ||
      row.deferred >= DEFERRED_RECHECK_THRESHOLD ||
      row.lease_expired > 0 ||
      ((row.recent_failed > 0 || row.recent_deferred > 0) &&
        row.recent_completed === 0);
    const status = missed ? "missed" : degraded ? "degraded" : "healthy";
    const summary = {
      status,
      writesPerformed: 0,
      thresholds: {
        missedActivityMinutes: MISSED_ACTIVITY_MINUTES,
        staleOffers: STALE_OFFER_THRESHOLD,
        deferredRechecks: DEFERRED_RECHECK_THRESHOLD,
      },
      activity: {
        lastJobActivityAt: row.last_job_activity_at?.toISOString() ?? null,
        ageMinutes: activityAgeMinutes,
        recentCompleted: row.recent_completed,
        recentFailed: row.recent_failed,
        recentDeferred: row.recent_deferred,
      },
      backlog: {
        queued: row.queued,
        due: row.due,
        processing: row.processing,
        leaseExpired: row.lease_expired,
        deferred: row.deferred,
      },
      offers: { stale: row.stale_offers },
    };

    const log = status === "healthy" ? console.info : console.warn;
    log(
      JSON.stringify({
        event: "inventory_health_watchdog_checked",
        ...summary,
      }),
    );
    return Response.json(summary, { status: status === "healthy" ? 200 : 503 });
  } catch {
    console.error(
      JSON.stringify({
        event: "inventory_health_watchdog_failed",
        reason: "health_query_failed",
      }),
    );
    return Response.json(
      { error: "Inventory health is unavailable." },
      { status: 500 },
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
