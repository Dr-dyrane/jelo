import "server-only";

import { Redis } from "@upstash/redis";
import {
  MARKET_TRUTH_RECEIPT_TTL_SECONDS,
  createScheduledOwnerReceipt,
  parseScheduledOwnerReceipt,
  serializeScheduledOwnerReceipt,
} from "@/lib/market-truth/receipt-contract";
import {
  scheduledOwnerIds,
  type ScheduledOwnerId,
  type ScheduledOwnerOutcomeCode,
  type ScheduledOwnerReceipt,
  type ScheduledOwnerReceiptRead,
} from "@/lib/market-truth/types";
import {
  SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT,
  START_SCHEDULED_OWNER_IF_LATEST_SCRIPT,
} from "@/lib/market-truth/receipt-store-scripts";

const ledgerPrefix = "jelocare:market-truth:v1";
let redis: Redis | undefined;

type ReceiptRedis = Pick<Redis, "eval" | "get">;

function receiptEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  return env.VERCEL_ENV === "production"
    ? "production"
    : env.VERCEL_ENV === "preview"
      ? "preview"
      : "development";
}

export function scheduledOwnerReceiptKey(
  owner: ScheduledOwnerId,
  env: Record<string, string | undefined> = process.env,
) {
  return `${ledgerPrefix}:${receiptEnvironment(env)}:${owner}`;
}

export function scheduledOwnerRevision(
  env: Record<string, string | undefined> = process.env,
) {
  const candidate =
    env.VERCEL_GIT_COMMIT_SHA ?? env.NEXT_PUBLIC_APP_REVISION ?? "unavailable";
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(candidate)
    ? candidate
    : "unavailable";
}

function receiptLedger() {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || !url.startsWith("https://")) {
    throw new Error("market_truth_receipt_store_not_configured");
  }
  redis = new Redis({ url, token, automaticDeserialization: false });
  return redis;
}

async function readOneReceipt(
  client: ReceiptRedis,
  owner: ScheduledOwnerId,
): Promise<ScheduledOwnerReceiptRead> {
  const stored = await client.get<string>(scheduledOwnerReceiptKey(owner));
  if (stored === null) return { status: "missing" };
  if (typeof stored !== "string") return { status: "invalid" };
  try {
    const receipt = parseScheduledOwnerReceipt(JSON.parse(stored), owner);
    return receipt ? { status: "present", receipt } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

export async function readScheduledOwnerReceipts(
  client: ReceiptRedis = receiptLedger(),
) {
  const entries = await Promise.all(
    scheduledOwnerIds.map(
      async (owner) => [owner, await readOneReceipt(client, owner)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<
    ScheduledOwnerId,
    ScheduledOwnerReceiptRead
  >;
}

export async function recordScheduledOwnerStarted(
  input: {
    owner: ScheduledOwnerId;
    startedAt: string;
    revision?: string;
    counts?: Record<string, number>;
  },
  client: ReceiptRedis = receiptLedger(),
) {
  const receipt = createScheduledOwnerReceipt({
    ...input,
    revision: input.revision ?? scheduledOwnerRevision(),
    state: "started",
    outcomeCode: "started",
  });
  const started = await client.eval<[string, string, string], number>(
    START_SCHEDULED_OWNER_IF_LATEST_SCRIPT,
    [scheduledOwnerReceiptKey(input.owner)],
    [
      input.startedAt,
      serializeScheduledOwnerReceipt(receipt),
      String(MARKET_TRUTH_RECEIPT_TTL_SECONDS),
    ],
  );
  if (started !== 1) throw new Error("market_truth_receipt_superseded");
  return receipt;
}

async function settleScheduledOwner(
  input: {
    owner: ScheduledOwnerId;
    state: "completed" | "failed";
    startedAt: string;
    settledAt: string;
    outcomeCode: ScheduledOwnerOutcomeCode;
    counts?: Record<string, number>;
    revision?: string;
  },
  client: ReceiptRedis,
) {
  const receipt = createScheduledOwnerReceipt({
    ...input,
    revision: input.revision ?? scheduledOwnerRevision(),
  });
  const settled = await client.eval<[string, string, string], number>(
    SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT,
    [scheduledOwnerReceiptKey(input.owner)],
    [
      input.startedAt,
      serializeScheduledOwnerReceipt(receipt),
      String(MARKET_TRUTH_RECEIPT_TTL_SECONDS),
    ],
  );
  if (settled !== 1) throw new Error("market_truth_receipt_superseded");
  return receipt;
}

export async function recordScheduledOwnerCompleted(
  input: {
    owner: ScheduledOwnerId;
    startedAt: string;
    completedAt: string;
    outcomeCode: ScheduledOwnerOutcomeCode;
    counts?: Record<string, number>;
    revision?: string;
  },
  client: ReceiptRedis = receiptLedger(),
): Promise<ScheduledOwnerReceipt> {
  return settleScheduledOwner(
    {
      ...input,
      state: "completed",
      settledAt: input.completedAt,
    },
    client,
  );
}

export async function recordScheduledOwnerFailed(
  input: {
    owner: ScheduledOwnerId;
    startedAt: string;
    failedAt: string;
    outcomeCode: ScheduledOwnerOutcomeCode;
    counts?: Record<string, number>;
    revision?: string;
  },
  client: ReceiptRedis = receiptLedger(),
): Promise<ScheduledOwnerReceipt> {
  return settleScheduledOwner(
    { ...input, state: "failed", settledAt: input.failedAt },
    client,
  );
}
