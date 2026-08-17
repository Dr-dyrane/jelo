import "server-only";

import postgres from "postgres";
import {
  APPLICATION_RUNTIME_ROLE,
  applicationDatabaseUrl,
  isProductionApplicationRuntime,
} from "@/lib/database/runtime-database-config";

let client: ReturnType<typeof postgres> | undefined;

/**
 * The tagged-template postgres client returned by `getPostgresClient`.
 * Shared by repository modules so they can accept an injected client
 * without depending on `postgres` directly.
 */
export type PostgresClient = ReturnType<typeof getPostgresClient>;

function connectionString() {
  return applicationDatabaseUrl(process.env);
}

export function hasPostgresConfig() {
  return /^postgres(?:ql)?:\/\//.test(connectionString() ?? "");
}

export function getPostgresClient() {
  const configuredUrl = connectionString();

  if (!configuredUrl) {
    throw new Error(
      isProductionApplicationRuntime(process.env)
        ? "Runtime database access is unavailable."
        : "DATABASE_URL or POSTGRES_URL is required for Neon access.",
    );
  }

  if (!client) {
    client = postgres(configuredUrl, {
      ...(isProductionApplicationRuntime(process.env)
        ? { user: APPLICATION_RUNTIME_ROLE }
        : {}),
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return client;
}
