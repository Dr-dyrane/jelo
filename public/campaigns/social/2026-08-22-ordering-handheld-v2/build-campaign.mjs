import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const previousCampaign = path.resolve(
  directory,
  "..",
  "2026-08-22-ordering-handheld-v1",
);
const basePath = path.join(
  previousCampaign,
  "source",
  "handheld-phone-chroma-imagegen.png",
);
const screenPath = path.join(directory, "source", "retailer-shopping.png");
const outputName = "01-one-store-one-basket.jpg";
const outputPath = path.join(directory, outputName);

function textOverlay(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <g font-family="Arial, Helvetica, sans-serif">
      <rect x="348" y="194" width="245" height="78" rx="27" fill="#f59cac"/>
      <text x="470.5" y="248" text-anchor="middle" fill="#16070d" font-size="38" font-weight="750" letter-spacing="-1.6">JeloCare</text>
      <text x="470.5" y="376" text-anchor="middle" fill="#fff9f4" font-size="87" font-weight="800" letter-spacing="-4.8">One store.</text>
      <text x="470.5" y="470" text-anchor="middle" fill="#fff9f4" font-size="87" font-weight="800" letter-spacing="-4.8">One basket.</text>
    </g>
  </svg>`);
}

function reflectionOverlay(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".10"/>
        <stop offset=".28" stop-color="#fff" stop-opacity=".02"/>
        <stop offset=".52" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#fff" stop-opacity=".03"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#glass)"/>
  </svg>`);
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function findChromaScreen() {
  const { data, info } = await sharp(basePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixel = (y * info.width + x) * info.channels;
      const red = data[pixel];
      const green = data[pixel + 1];
      const blue = data[pixel + 2];
      const isChroma = green > 25 && green - red > 4 && green - blue > 3;

      if (!isChroma) continue;

      alpha[y * info.width + x] = 255;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) {
    throw new Error("The handheld master has no chroma screen.");
  }

  const bounds = {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  const mask = await sharp(alpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .extract(bounds)
    .png()
    .toBuffer();

  return { bounds, mask, width: info.width, height: info.height };
}

async function build() {
  const screen = await findChromaScreen();
  const sourceScreen = await sharp(screenPath)
    .resize(screen.bounds.width, screen.bounds.height, {
      fit: "contain",
      background: "#fff7f1",
    })
    .joinChannel(screen.mask)
    .png()
    .toBuffer();
  const glass = await sharp(
    reflectionOverlay(screen.bounds.width, screen.bounds.height),
  )
    .joinChannel(screen.mask)
    .png()
    .toBuffer();

  const composedMaster = await sharp(basePath)
    .composite([
      {
        input: sourceScreen,
        left: screen.bounds.left,
        top: screen.bounds.top,
      },
      { input: glass, left: screen.bounds.left, top: screen.bounds.top },
      { input: textOverlay(screen.width, screen.height) },
    ])
    .png()
    .toBuffer();

  await sharp(composedMaster)
    .resize(1080, 1920, { fit: "fill" })
    .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(outputPath);

  const outputMetadata = await sharp(outputPath).metadata();
  const photoHash = await sha256(basePath);
  const screenHash = await sha256(screenPath);
  const outputHash = await sha256(outputPath);
  const createdAt = new Date().toISOString();

  const campaign = {
    schemaVersion: 1,
    campaignId: "2026-08-22-ordering-handheld-v2",
    status: "draft",
    createdAt,
    dataCheckedAt: createdAt,
    objective:
      "Show JeloCare's guest shopping state through a premium photographic handheld-phone campaign master without cropping or browser chrome.",
    sourceTruth: {
      repositoryCommit: "9106a0a8581fcc6ca73c428a60ac3fc2774e80d9",
      viewportEvidence:
        "Exact JeloCare retailer shopping page captured in headless Chromium at a 430 × 947 CSS-pixel mobile viewport and 3× device scale. No browser chrome, no real customer data, no payment, email, or WhatsApp send.",
      basketEvidence:
        "Development-only guest basket with Aqua Rich Hydrate + Protect Body Lotion and Advanced Clinicals Vitamin C Face Serum at CSi Grocery.",
      visualSystem:
        "The photographic hand-and-phone master was generated without UI or text. The exact JeloCare viewport and campaign copy were composited deterministically with contain scaling.",
    },
    sourceAsset: {
      path: "../2026-08-22-ordering-handheld-v1/source/handheld-phone-chroma-imagegen.png",
      sha256: photoHash,
      generationRoute: "reused-built-in-imagegen",
      promptBoundary:
        "Text-free, logo-free dark-skinned hand holding a generic front-facing phone with a chroma screen on a deep black-cherry field.",
    },
    interfaceEvidence: {
      path: "source/retailer-shopping.png",
      sha256: screenHash,
      captureRoute: "playwright-core-local-mobile-viewport",
      viewport: { width: 430, height: 947, deviceScaleFactor: 3 },
    },
    careBoundary:
      "Ordering workflow only. No suitability, treatment, diagnosis, authenticity, saving, stock guarantee, or clinical outcome claim.",
    copy: {
      headline: "One store. One basket.",
      productLine: null,
      priceLine: null,
      action: "Browse products",
      disclaimer:
        "Products, delivery and fees are verified before quote approval. No payment is taken during the request.",
      embeddedUrl: null,
    },
    creative: [
      {
        mode: "dark",
        path: outputName,
        width: outputMetadata.width,
        height: outputMetadata.height,
        sha256: outputHash,
        generationRoute:
          "reused-built-in-imagegen-photographic-master-plus-deterministic-exact-screen-composite",
      },
    ],
    channels: ["whatsapp-status", "instagram-stories", "snapchat"],
    publication: [],
  };

  await writeFile(
    path.join(directory, "campaign.json"),
    `${JSON.stringify(campaign, null, 2)}\n`,
  );
  await writeFile(
    path.join(directory, "CAPTION.md"),
    "# Draft caption\n\nOne store. One basket. Start with an exact product, then keep shopping at the same retailer before requesting one verified quote.\n\nBrowse: https://www.jelocare.com/products\n\nProducts, delivery and fees are verified before quote approval. No payment is taken during the request.\n",
  );
  await writeFile(
    path.join(directory, "SHA256SUMS"),
    `${outputHash}  ${outputName}\n${screenHash}  source/retailer-shopping.png\n`,
  );
}

await build();
