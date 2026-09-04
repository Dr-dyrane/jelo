const BROWSER_PACK_PATH = "/chromium-pack.tar";
const PRODUCTION_SITE_ORIGIN = "https://www.jelocare.com";

export function serverlessBrowserPackUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  if (environment.VERCEL !== "1" || environment.VERCEL_ENV !== "production") {
    return undefined;
  }

  const configuredOrigin =
    environment.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE_ORIGIN;

  try {
    const origin = new URL(configuredOrigin);
    if (
      origin.origin !== PRODUCTION_SITE_ORIGIN ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      return undefined;
    }
    return new URL(BROWSER_PACK_PATH, origin).toString();
  } catch {
    return undefined;
  }
}
