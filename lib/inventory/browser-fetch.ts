import "server-only";
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serverlessBrowserPackUrl } from "@/lib/inventory/browser-runtime";

// Browser-based fallback fetch for retailer pages that block plain server-side
// HTTP (e.g. Jumia/Cloudflare 403). This module is a pure fetch mechanism: it
// returns the rendered HTML and final URL. It does NOT parse prices, does NOT
// update offers, and does NOT touch the database. The caller (refresh-worker)
// is responsible for extraction and persistence using the existing
// confidence-gated logic.
//
// Browser dependencies are dynamically imported inside the function so that
// they never affect cold start when the fallback is not needed. Production
// uses a compact, self-hosted Chromium pack that can run inside a Vercel
// Function; local development keeps Playwright's normal browser resolution.

export type BrowserFetchResult = {
  html: string;
  responseUrl: string;
  status: number;
};

const BROWSER_FETCH_TIMEOUT_MS = 15_000;
const BROWSER_PREWARM_TIMEOUT_MS = 45_000;
const SERVERLESS_BROWSER_PACK_DIRECTORY = "chromium-pack";
const SERVERLESS_BROWSER_PROFILE_DIRECTORY = "inventory-browser-profile";
const SERVERLESS_BROWSER_PROFILE_PREFIX = "playwright_chromiumdev_profile-";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
let serverlessExecutablePathPromise: Promise<string> | undefined;
let serverlessBrowserContextPromise:
  Promise<import("playwright-core").BrowserContext> | undefined;
let serverlessBrowserCleanupPromise: Promise<void> | undefined;
let serverlessPageQueue: Promise<void> = Promise.resolve();

async function reclaimServerlessBrowserDisk(): Promise<void> {
  const temporaryDirectory = tmpdir();
  const entries = await readdir(temporaryDirectory).catch(() => []);
  const disposableEntries = entries.filter(
    (entry) =>
      entry === SERVERLESS_BROWSER_PACK_DIRECTORY ||
      entry === SERVERLESS_BROWSER_PROFILE_DIRECTORY ||
      entry.startsWith(SERVERLESS_BROWSER_PROFILE_PREFIX),
  );

  await Promise.all(
    disposableEntries.map((entry) =>
      rm(join(temporaryDirectory, entry), { force: true, recursive: true }),
    ),
  );
}

function lowDiskServerlessArgs(args: string[]): string[] {
  return [
    ...args.filter((argument) => !argument.startsWith("--disk-cache-size=")),
    "--disk-cache-size=0",
    "--media-cache-size=0",
    "--disable-application-cache",
  ];
}

async function releaseServerlessExecutable(
  executablePath: string,
  profileDirectory: string,
) {
  try {
    // Keep the executable available for Chromium's entire connected lifetime.
    // A replacement browser waits for this cleanup before expanding or launching
    // again, so it can never race an unlink of the previous runtime.
    await Promise.all([
      rm(executablePath, { force: true }),
      rm(profileDirectory, { force: true, recursive: true }),
    ]);
    console.info(
      JSON.stringify({ event: "browser_runtime_executable_released" }),
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "browser_runtime_disk_reclaim_failed",
        reason: error instanceof Error ? error.name : "unknown",
      }),
    );
  } finally {
    serverlessExecutablePathPromise = undefined;
  }
}

function queueServerlessExecutableRelease(
  executablePath: string,
  profileDirectory: string,
) {
  const cleanupPromise = releaseServerlessExecutable(
    executablePath,
    profileDirectory,
  );
  serverlessBrowserCleanupPromise = cleanupPromise;
  void cleanupPromise.finally(() => {
    if (serverlessBrowserCleanupPromise === cleanupPromise) {
      serverlessBrowserCleanupPromise = undefined;
    }
  });
  return cleanupPromise;
}

async function serverlessBrowserLaunchOptions() {
  const packUrl = serverlessBrowserPackUrl();
  if (!packUrl) {
    throw new Error(
      "Vercel browser runtime is missing its public production pack URL.",
    );
  }

  const serverlessChromium = (await import("@sparticuz/chromium-min")).default;
  serverlessChromium.setGraphicsMode = false;
  serverlessExecutablePathPromise ??= serverlessChromium
    .executablePath(packUrl)
    .catch((error) => {
      serverlessExecutablePathPromise = undefined;
      throw error;
    });

  return {
    args: lowDiskServerlessArgs(serverlessChromium.args),
    executablePath: await serverlessExecutablePathPromise,
  };
}

async function sharedServerlessBrowserContext(
  chromium: typeof import("playwright-core").chromium,
) {
  if (serverlessBrowserCleanupPromise) {
    await serverlessBrowserCleanupPromise;
  }

  if (!serverlessBrowserContextPromise) {
    let executablePath: string | undefined;
    const profileDirectory = join(
      tmpdir(),
      SERVERLESS_BROWSER_PROFILE_DIRECTORY,
    );
    let runtimeCleanupPromise: Promise<void> | undefined;
    const cleanupRuntime = () => {
      runtimeCleanupPromise ??= queueServerlessExecutableRelease(
        executablePath ?? join(tmpdir(), "chromium"),
        profileDirectory,
      );
      return runtimeCleanupPromise;
    };
    const launchPromise = (async () => {
      const launchOptions = await serverlessBrowserLaunchOptions();
      executablePath = launchOptions.executablePath;
      // chromium-min expands the remote pack beside the executable. Once the
      // expansion is complete those compressed inputs are redundant, while
      // Playwright profiles left by a crashed browser can consume the rest of
      // Vercel's bounded /tmp volume. Reclaim both before every fresh launch.
      await reclaimServerlessBrowserDisk();
      // Sparticuz documents that incognito BrowserContext creation can fail
      // with Target.closed in serverless Chromium. A persistent launch owns
      // Chromium's default context, so jobs share only an anonymous context
      // while every page is serialized and cleared below.
      const context = await chromium.launchPersistentContext(profileDirectory, {
        headless: true,
        args: launchOptions.args,
        executablePath: launchOptions.executablePath,
        userAgent: BROWSER_USER_AGENT,
        serviceWorkers: "block",
      });
      await context.addInitScript(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // Opaque origins do not expose storage; retailer origins do.
        }
      });
      const browser = context.browser();
      if (!browser) {
        await context.close();
        throw new Error(
          "Serverless browser did not expose a connected runtime.",
        );
      }
      const releaseExecutableAfterDisconnect = () => {
        if (serverlessBrowserContextPromise === cachedPromise) {
          serverlessBrowserContextPromise = undefined;
        }
        void cleanupRuntime();
      };
      browser.on("disconnected", releaseExecutableAfterDisconnect);
      if (!browser.isConnected()) {
        releaseExecutableAfterDisconnect();
        throw new Error("Serverless browser disconnected during launch.");
      }
      return context;
    })();
    const cachedPromise = launchPromise.catch(async (error) => {
      if (serverlessBrowserContextPromise === cachedPromise) {
        serverlessBrowserContextPromise = undefined;
      }
      if (executablePath) {
        await cleanupRuntime();
      }
      throw error;
    });
    serverlessBrowserContextPromise = cachedPromise;
  }

  return serverlessBrowserContextPromise;
}

async function withServerlessPageLease<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  const previous = serverlessPageQueue;
  let release: () => void = () => undefined;
  serverlessPageQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function resetServerlessBrowserContext(
  context: import("playwright-core").BrowserContext,
) {
  await Promise.all(
    context.pages().map((page) => page.close().catch(() => undefined)),
  );
  await Promise.all([context.clearCookies(), context.clearPermissions()]);
}

export async function prepareBrowserFetchRuntime(): Promise<boolean> {
  if (!isBrowserFetchAvailable()) return false;
  if (process.env.VERCEL !== "1") return true;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const playwright = await import("playwright-core");
    const ready = await Promise.race([
      withServerlessPageLease(async () => {
        const context = await sharedServerlessBrowserContext(
          playwright.chromium,
        );
        // Launch alone does not exercise Chromium's writable profile. Open one
        // page in its default anonymous context so a constrained /tmp is
        // surfaced before jobs are leased for real retailer navigation.
        await resetServerlessBrowserContext(context);
        const page = await context.newPage();
        try {
          await page.setContent(
            "<!doctype html><title>inventory prewarm</title>",
          );
        } finally {
          await page.close();
          await resetServerlessBrowserContext(context);
        }
        return true;
      }),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), BROWSER_PREWARM_TIMEOUT_MS);
      }),
    ]);
    console.info(
      JSON.stringify({
        event: ready
          ? "browser_runtime_prepared"
          : "browser_runtime_prepare_failed",
        reason: ready ? undefined : "timeout",
      }),
    );
    return ready;
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "browser_runtime_prepare_failed",
        reason: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

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
    if (process.env.VERCEL === "1") {
      require.resolve("@sparticuz/chromium-min");
      return serverlessBrowserPackUrl() != null;
    }
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
  options: { signal?: AbortSignal } = {},
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

  const useSharedServerlessBrowser = process.env.VERCEL === "1";
  const fetchOnce = async () => {
    let browser: import("playwright-core").Browser | undefined;
    let context: import("playwright-core").BrowserContext | undefined;
    let page: import("playwright-core").Page | undefined;
    const closePageOnAbort = () => {
      if (page) void page.close().catch(() => undefined);
    };
    options.signal?.addEventListener("abort", closePageOnAbort, {
      once: true,
    });
    try {
      if (options.signal?.aborted) return undefined;
      if (useSharedServerlessBrowser) {
        context = await sharedServerlessBrowserContext(chromium);
        await resetServerlessBrowserContext(context);
      } else {
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        context = await browser.newContext({
          userAgent: BROWSER_USER_AGENT,
          serviceWorkers: "block",
        });
      }
      if (options.signal?.aborted) return undefined;
      page = await context.newPage();
      // The worker deadline can fire while Chromium is creating the target.
      // Recheck after newPage so an already-aborted request never navigates or
      // holds the shared serverless lease beyond its deadline.
      if (options.signal?.aborted) return undefined;
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: BROWSER_FETCH_TIMEOUT_MS,
      });
      if (response && !response.ok()) {
        console.warn(
          JSON.stringify({
            event: "browser_fetch_failed",
            url,
            error: `Browser received HTTP ${response.status()}`,
          }),
        );
        return undefined;
      }
      const html = await page.content();
      const responseUrl = page.url();
      const status = response?.status() ?? 200;
      return { html, responseUrl, status };
    } catch (error) {
      if (options.signal?.aborted) return undefined;
      console.warn(
        JSON.stringify({
          event: "browser_fetch_failed",
          url,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return undefined;
    } finally {
      options.signal?.removeEventListener("abort", closePageOnAbort);
      if (page) {
        try {
          await page.close();
        } catch {
          // Browser failure may already have torn down the page.
        }
      }
      if (context && useSharedServerlessBrowser) {
        try {
          await resetServerlessBrowserContext(context);
        } catch {
          // Browser failure may already have torn down the shared context.
        }
      }
      if (context && !useSharedServerlessBrowser) {
        try {
          await context.close();
        } catch {
          // Browser failure may already have torn down the isolated context.
        }
      }
      if (browser && !useSharedServerlessBrowser) {
        try {
          await browser.close();
        } catch {
          // Best-effort cleanup; a failed launch may have already torn down.
        }
      }
    }
  };

  if (useSharedServerlessBrowser) {
    return withServerlessPageLease(fetchOnce);
  }
  return fetchOnce();
}
