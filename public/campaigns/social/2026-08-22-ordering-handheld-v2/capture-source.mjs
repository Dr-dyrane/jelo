import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(directory, "source", "retailer-shopping.png");
const baseUrl = process.env.JELOCARE_CAPTURE_URL ?? "http://127.0.0.1:3024";

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 430, height: 947 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });

  await context.addInitScript(() => {
    localStorage.setItem(
      "jelocare:basket:v1",
      JSON.stringify([
        {
          slug: "aqua-rich-ceramide-body-lotion-500ml",
          quantity: 1,
        },
        {
          slug: "advanced-clinicals-vitamin-c-face-serum-52ml",
          quantity: 1,
        },
      ]),
    );
    localStorage.setItem("jelocare:checkout-retailer:v1", "CSi Grocery");
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/retailers/csi-grocery?shopping=1`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => {
    document.querySelector("nextjs-portal")?.remove();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: outputPath,
    animations: "disabled",
    fullPage: false,
  });
} finally {
  await browser.close();
}

console.log(outputPath);
