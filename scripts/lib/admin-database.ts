const RESERVED_RUNTIME_DATABASE_ROLES = new Set([
  "jelocare_app_runtime",
  "jelocare_shelf_runtime",
]);

export const ADMIN_DATABASE_ENVIRONMENT_VARIABLE = "MIGRATION_DATABASE_URL";
export const REHEARSAL_DATABASE_ENVIRONMENT_VARIABLE =
  "MIGRATION_REHEARSAL_DATABASE_URL";

type AdminDatabaseEnvironment = {
  MIGRATION_DATABASE_URL?: string;
  MIGRATION_REHEARSAL_DATABASE_URL?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  [key: string]: string | undefined;
};

function requireProtectedDatabaseUrl(
  variable:
    | typeof ADMIN_DATABASE_ENVIRONMENT_VARIABLE
    | typeof REHEARSAL_DATABASE_ENVIRONMENT_VARIABLE,
  environment: AdminDatabaseEnvironment,
) {
  const candidate = environment[variable];
  if (!/^postgres(?:ql)?:\/\//.test(candidate ?? "")) {
    throw new Error(`${variable} is required for this database operator.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate!);
  } catch {
    throw new Error(`${variable} is not a valid PostgreSQL URL.`);
  }

  const username = decodeURIComponent(parsed.username);
  if (!username || RESERVED_RUNTIME_DATABASE_ROLES.has(username)) {
    throw new Error(`${variable} must use a protected administrative role.`);
  }
  if (parsed.hostname.toLowerCase().includes("-pooler.")) {
    throw new Error(
      `${variable} must use a direct, non-pooled database endpoint.`,
    );
  }

  return candidate!;
}

export function requireAdminDatabaseUrl(
  environment: AdminDatabaseEnvironment = process.env,
) {
  return requireProtectedDatabaseUrl(
    ADMIN_DATABASE_ENVIRONMENT_VARIABLE,
    environment,
  );
}

export function requireRehearsalDatabaseUrl(
  environment: AdminDatabaseEnvironment = process.env,
) {
  if (environment.MIGRATION_DATABASE_URL) {
    throw new Error(
      "Unset MIGRATION_DATABASE_URL before rehearsal; production authority must not enter this path.",
    );
  }
  if (environment.VERCEL || environment.VERCEL_ENV) {
    throw new Error(
      "Migration rehearsal is unavailable in every Vercel environment.",
    );
  }
  return requireProtectedDatabaseUrl(
    REHEARSAL_DATABASE_ENVIRONMENT_VARIABLE,
    environment,
  );
}
