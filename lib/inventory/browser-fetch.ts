import "server-only";

// Browser-based fallback fetch for retailer pages that block plain server-side
// HTTP (e.g. Jumia/Cloudflare 403). This module is a pure fetch mechanism: it
// returns the rendered HTML and final URL. It does NOT parse prices, does NOT
// update offers, and does NOT touch the database. The caller (refresh-worker)
// is responsible for extraction and persistence using the existing
// confidence-gated logic.
//
// playwright-core is dynamically imported inside the function so that it never
// affects cold start when the browser fallback is not needed.

export type BrowserFetchResult = {
  html: string;
  responseUrl: string;
  status: number;
};

const BROWSER_FETCH_TIMEOUT_MS = 15_000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Reports whether the Playwright browser fallback is available without
 * launching a browser. Returns true only if `playwright-core` can be
 * resolved. This is safe to call on the hot path; it never imports the
 * library into module scope.
 */
export function isBrowserFetchAvailable(): boolean {
  try {
    // require.resolve is the cheapest way to check install status without
    // loading the module into memory. Wrapped in try/catch so a missing
    // package degrades gracefully to false.
    require.resolve("playwright-core");
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches a retailer page using a headless Chromium browser, working around
 * hosts that return 403 to plain server-side HTTP (e.g. Cloudflare-protected
 * sites). Returns the rendered HTML, final URL after redirects, and HTTP
 * status — or `undefined` on any failure.
 *
 * This function only fetches HTML. It does not parse or persist anything.
 */
export async function fetchRetailerPageWithBrowser(
  url: string,
): Promise<BrowserFetchResult | undefined> {
  // Lazy-load playwright-core so the dependency never impacts cold start.
  let chromium: typeof import("playwright-core").chromium;
  try {
    const playwright = await import("playwright-core");
    chromium = playwright.chromium;
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "browser_fetch_failed",
        url,
        error:
          error instanceof Error
            ? error.message
            : "playwright-core is not installed",
      }),
    );
    return undefined;
  }

  let browser: import("playwright-core").Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      userAgent: BROWSER_USER_AGENT,
    });
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: BROWSER_FETCH_TIMEOUT_MS,
    });
    const html = await page.content();
    const responseUrl = page.url();
    const status = response?.status() ?? 200;
    await context.close();
    return { html, responseUrl, status };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "browser_fetch_failed",
        url,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return undefined;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Best-effort cleanup; a failed launch may have already torn down.
      }
    }
  }
}
