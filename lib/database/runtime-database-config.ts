export const APPLICATION_RUNTIME_ROLE = "jelocare_app_runtime";

type RuntimeDatabaseEnvironment = {
  NODE_ENV?: string;
  APP_DATABASE_URL?: string;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
};

export function isProductionApplicationRuntime(
  environment: RuntimeDatabaseEnvironment,
) {
  return environment.NODE_ENV === "production";
}

export function applicationDatabaseUrl(
  environment: RuntimeDatabaseEnvironment,
) {
  // APP_DATABASE_URL takes precedence so the Neon Vercel integration's
  // auto-generated DATABASE_URL (which uses the neondb_owner role) cannot
  // override the restricted jelocare_app_runtime credential.
  const candidate =
    environment.APP_DATABASE_URL ??
    environment.DATABASE_URL ??
    environment.POSTGRES_URL;
  if (!/^postgres(?:ql)?:\/\//.test(candidate ?? "")) return undefined;
  if (!isProductionApplicationRuntime(environment)) return candidate;

  try {
    const username = decodeURIComponent(new URL(candidate!).username);
    return username === APPLICATION_RUNTIME_ROLE ? candidate : undefined;
  } catch {
    return undefined;
  }
}
