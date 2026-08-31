export const APPLICATION_RUNTIME_ROLE = "jelocare_app_runtime";

type RuntimeDatabaseEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  APP_DATABASE_URL?: string;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
};

export function isProductionApplicationRuntime(
  environment: RuntimeDatabaseEnvironment,
) {
  return (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "preview" ||
    environment.VERCEL_ENV === "production"
  );
}

export function applicationDatabaseUrl(
  environment: RuntimeDatabaseEnvironment,
) {
  // Production-mode runtimes, including Vercel Preview and Production, accept
  // only the explicitly provisioned restricted application credential. Local
  // development and tests retain the legacy aliases for compatibility.
  const production = isProductionApplicationRuntime(environment);
  const candidate = production
    ? environment.APP_DATABASE_URL
    : (environment.APP_DATABASE_URL ??
      environment.DATABASE_URL ??
      environment.POSTGRES_URL);
  if (!/^postgres(?:ql)?:\/\//.test(candidate ?? "")) return undefined;
  if (!production) return candidate;

  try {
    const username = decodeURIComponent(new URL(candidate!).username);
    return username === APPLICATION_RUNTIME_ROLE ? candidate : undefined;
  } catch {
    return undefined;
  }
}
