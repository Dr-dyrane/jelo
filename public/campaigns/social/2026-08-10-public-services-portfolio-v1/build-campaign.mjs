import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, "source", "immersive-master-field-imagegen.png");

const services = [
  {
    id: "products",
    eyebrow: "THE CATALOGUE",
    headline: ["Browse the", "shelf."],
    body: ["Exact products.", "Clear context."],
    action: "Explore products",
    targetPath: "/products",
    accent: "#ef8ea0",
    motif: "products",
  },
  {
    id: "price-watch",
    eyebrow: "PRICE WATCH",
    headline: ["Prices that", "help."],
    body: ["Observed prices", "worth passing on."],
    action: "Compare prices",
    targetPath: "/share",
    accent: "#ff9b87",
    motif: "price",
    disclaimer: "Prices change.",
  },
  {
    id: "bundle-finder",
    eyebrow: "BUNDLE FINDER",
    headline: ["Build one", "basket."],
    body: ["Choose 2–4 products.", "Compare one retailer."],
    action: "Find a bundle",
    targetPath: "/bundle",
    accent: "#f4b45f",
    motif: "bundle",
    disclaimer: "Product totals exclude delivery.",
  },
  {
    id: "ask-jelocare",
    eyebrow: "ASK JELOCARE",
    headline: ["Tell us what", "you notice."],
    body: ["A simple, sourced", "care guide."],
    action: "Ask JeloCare",
    targetPath: "/consult",
    accent: "#f3a3af",
    motif: "consult",
    disclaimer: "Guidance, not a diagnosis.",
  },
  {
    id: "concern-guides",
    eyebrow: "CONCERN GUIDES",
    headline: ["Start with what", "you notice."],
    body: ["Calm, educational guides", "for skin and hair concerns."],
    action: "Browse guides",
    targetPath: "/concerns",
    accent: "#c8a7ff",
    motif: "concerns",
    disclaimer: "Guidance, not a diagnosis.",
  },
  {
    id: "ingredient-library",
    eyebrow: "INGREDIENT LIBRARY",
    headline: ["Know what’s", "inside."],
    body: ["Read the evidence", "and cautions."],
    action: "Explore ingredients",
    targetPath: "/ingredients",
    accent: "#91d4c0",
    motif: "ingredients",
    disclaimer: "Key ingredients only. Check your pack.",
  },
  {
    id: "brand-directory",
    eyebrow: "BRAND DIRECTORY",
    headline: ["Find the", "name first."],
    body: ["Exact products under one", "canonical brand name."],
    action: "Browse brands",
    targetPath: "/brands",
    accent: "#b4b7ff",
    motif: "brands",
  },
  {
    id: "retailer-guide",
    eyebrow: "RETAILER GUIDE",
    headline: ["Stores", "we check."],
    body: ["Nigeria first.", "Exact products only."],
    action: "Browse retailers",
    targetPath: "/retailers",
    accent: "#ffb585",
    motif: "retailers",
    disclaimer: "A listing is not proof of authenticity.",
  },
  {
    id: "contribute",
    eyebrow: "COMMUNITY LIBRARY",
    headline: ["Tell us about", "one product."],
    body: ["Share what you use.", "No account."],
    action: "Contribute a note",
    targetPath: "/contribute",
    accent: "#f5d071",
    motif: "contribute",
  },
  {
    id: "global-search",
    eyebrow: "SEARCH JELOCARE",
    headline: ["Find clear", "context."],
    body: ["Products. Guides. Ingredients.", "Brands. Retailers."],
    action: "Search JeloCare",
    targetPath: "/search",
    accent: "#8ed6ff",
    motif: "search",
  },
  {
    id: "my-jelocare",
    eyebrow: "MY JELOCARE",
    headline: ["Shelf. Routine.", "Ask."],
    body: ["Your private", "JeloCare workspace."],
    action: "Open My JeloCare",
    targetPath: "/me",
    accent: "#e9a6d8",
    motif: "me",
  },
  {
    id: "retailer-partnership",
    eyebrow: "FOR STORES",
    headline: ["Be easier", "to find."],
    body: ["Physical or online.", "No website required."],
    action: "List your store",
    targetPath: "/retailers#list-your-store",
    accent: "#eac58f",
    motif: "partnership",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function motif(kind, accent) {
  const stroke = `stroke="${accent}" stroke-width="3" fill="none"`;
  const quiet = `stroke="${accent}" stroke-opacity=".36" stroke-width="2" fill="none"`;
  const glass = `fill="${accent}" fill-opacity=".10" stroke="${accent}" stroke-opacity=".58" stroke-width="2"`;
  switch (kind) {
    case "products":
      return `<g transform="translate(0 18)">
        <rect x="330" y="42" width="122" height="326" rx="60" ${glass}/>
        <rect x="480" y="0" width="122" height="410" rx="60" ${glass}/>
        <rect x="630" y="78" width="122" height="290" rx="60" ${glass}/>
        <path d="M352 300h78M502 320h78M652 288h78" ${quiet}/>
      </g>`;
    case "price":
      return `<g>
        <circle cx="365" cy="215" r="116" ${glass}/>
        <circle cx="715" cy="215" r="116" ${glass}/>
        <path d="M486 215h108m-20-20 20 20-20 20" ${stroke}/>
        <path d="M318 215h94M668 215h94" ${quiet}/>
      </g>`;
    case "bundle":
      return `<g>
        <circle cx="365" cy="92" r="58" ${glass}/><circle cx="540" cy="30" r="58" ${glass}/><circle cx="715" cy="92" r="58" ${glass}/>
        <path d="M365 160c0 100 175 74 175 184M540 98v246M715 160c0 100-175 74-175 184" ${quiet}/>
        <ellipse cx="540" cy="366" rx="202" ry="54" ${glass}/>
      </g>`;
    case "consult":
      return `<g>
        <path d="M310 116c0-48 38-86 86-86h288c48 0 86 38 86 86v138c0 48-38 86-86 86H516l-92 68 18-68h-46c-48 0-86-38-86-86z" ${glass}/>
        <path d="M403 180h274M403 230h180" ${quiet}/>
      </g>`;
    case "concerns":
      return `<g>
        <path d="M540 12c126 0 228 88 228 196s-102 196-228 196-228-88-228-196S414 12 540 12z" ${quiet}/>
        <path d="M540 78c84 0 152 58 152 130s-68 130-152 130-152-58-152-130S456 78 540 78z" ${quiet}/>
        <circle cx="540" cy="208" r="54" ${glass}/>
        <circle cx="334" cy="110" r="9" fill="${accent}"/><circle cx="742" cy="302" r="9" fill="${accent}"/>
      </g>`;
    case "ingredients":
      return `<g>
        <circle cx="540" cy="202" r="82" ${glass}/>
        <circle cx="350" cy="82" r="48" ${glass}/><circle cx="730" cy="82" r="48" ${glass}/>
        <circle cx="350" cy="350" r="48" ${glass}/><circle cx="730" cy="350" r="48" ${glass}/>
        <path d="M398 112l76 48m132 0 76-48M398 322l76-66m132 0 76 66" ${quiet}/>
      </g>`;
    case "brands":
      return `<g font-family="Georgia, serif" font-weight="400" fill="${accent}">
        <text x="260" y="310" font-size="292" fill-opacity=".12">A</text>
        <text x="460" y="310" font-size="292" fill-opacity=".22">—</text>
        <text x="640" y="310" font-size="292" fill-opacity=".12">Z</text>
      </g>`;
    case "retailers":
      return `<g>
        <path d="M540 12c-102 0-184 82-184 184 0 138 184 242 184 242s184-104 184-242C724 94 642 12 540 12z" ${glass}/>
        <circle cx="540" cy="190" r="66" ${quiet}/>
        <path d="M322 398h436" ${quiet}/>
      </g>`;
    case "contribute":
      return `<g>
        <path d="M404 38h272l92 92v270H404z" ${glass}/>
        <path d="M676 38v96h92M462 212h244M462 274h170" ${quiet}/>
        <path d="M312 400h456" ${stroke}/>
      </g>`;
    case "search":
      return `<g>
        <circle cx="495" cy="182" r="154" ${glass}/>
        <path d="M608 294l158 144" ${stroke}/>
        <path d="M495 76v212M389 182h212" ${quiet}/>
        <circle cx="495" cy="182" r="18" fill="${accent}" fill-opacity=".84"/>
      </g>`;
    case "me":
      return `<g>
        <path d="M322 350h436" ${stroke}/>
        <rect x="350" y="108" width="92" height="220" rx="45" ${glass}/>
        <rect x="494" y="38" width="92" height="290" rx="45" ${glass}/>
        <rect x="638" y="150" width="92" height="178" rx="45" ${glass}/>
        <circle cx="540" cy="40" r="206" ${quiet}/>
      </g>`;
    case "partnership":
      return `<g>
        <path d="M356 142h368v258H356zM326 142l48-96h332l48 96" ${glass}/>
        <path d="M472 400V234h136v166M326 142h428" ${quiet}/>
        <path d="M540 6v-68M432 18l-52-62M648 18l52-62" ${quiet}/>
      </g>`;
    default:
      return "";
  }
}

function overlay(service, index) {
  const headlineLines = service.headline
    .map((line, lineIndex) => `<tspan x="120" dy="${lineIndex === 0 ? 0 : 96}">${escapeXml(line)}</tspan>`)
    .join("");
  const bodyLines = service.body
    .map((line, lineIndex) => `<tspan x="120" dy="${lineIndex === 0 ? 0 : 38}">${escapeXml(line)}</tspan>`)
    .join("");
  return Buffer.from(`<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="serviceGlow" cx="50%" cy="55%" r="58%">
        <stop offset="0" stop-color="${service.accent}" stop-opacity=".22"/>
        <stop offset="1" stop-color="${service.accent}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#020203" stop-opacity=".28"/>
        <stop offset=".52" stop-color="#17070c" stop-opacity=".08"/>
        <stop offset="1" stop-color="#020203" stop-opacity=".38"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#shade)"/>
    <ellipse cx="540" cy="1050" rx="500" ry="530" fill="url(#serviceGlow)"/>

    <g font-family="Arial, sans-serif" fill="#f7f1ed">
      <text x="120" y="272" font-size="36" letter-spacing="-.8"><tspan font-weight="700">Jelo</tspan><tspan font-weight="300">Care</tspan></text>
      <text x="960" y="268" text-anchor="end" font-size="18" letter-spacing="2.8" fill="#f7f1ed" fill-opacity=".54">${String(index + 1).padStart(2, "0")} / ${String(services.length).padStart(2, "0")}</text>
      <text x="120" y="370" font-size="17" font-weight="700" letter-spacing="4" fill="${service.accent}">${escapeXml(service.eyebrow)}</text>
    </g>

    <text x="120" y="482" font-family="Georgia, serif" font-size="92" font-weight="400" letter-spacing="-4" fill="#fffaf6">${headlineLines}</text>
    <text x="120" y="700" font-family="Arial, sans-serif" font-size="31" font-weight="400" fill="#f6eeea" fill-opacity=".76">${bodyLines}</text>

    <g transform="translate(0 824)">${motif(service.motif, service.accent)}</g>

    <g font-family="Arial, sans-serif">
      <path d="M120 1494h840" stroke="#fff" stroke-opacity=".17"/>
      <circle cx="134" cy="1555" r="7" fill="${service.accent}"/>
      <text x="158" y="1564" font-size="28" fill="#fffaf6">${escapeXml(service.action)}</text>
      <text x="960" y="1564" text-anchor="end" font-size="28" fill="${service.accent}">↗</text>
      <text x="120" y="1620" font-size="18" letter-spacing=".5" fill="#fffaf6" fill-opacity=".48">${escapeXml(service.disclaimer ?? "Clear context, one step at a time.")}</text>
    </g>
  </svg>`);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function build() {
  const sourceHash = await sha256(sourcePath);
  const outputs = [];

  for (const [index, service] of services.entries()) {
    const outputName = `${String(index + 1).padStart(2, "0")}-${service.id}-story.png`;
    const outputPath = path.join(directory, outputName);
    await sharp(sourcePath)
      .resize(1080, 1920, { fit: "cover", position: "centre" })
      .composite([{ input: overlay(service, index), blend: "over" }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);

    const metadata = await sharp(outputPath).metadata();
    outputs.push({
      service,
      outputName,
      outputPath,
      width: metadata.width,
      height: metadata.height,
      sha256: await sha256(outputPath),
    });
  }

  const createdAt = new Date().toISOString();
  const campaign = {
    schemaVersion: 1,
    campaignId: "2026-08-10-public-services-portfolio-v1",
    status: "draft",
    createdAt,
    dataCheckedAt: createdAt,
    objective: "Introduce every distinct public JeloCare service through one cohesive, immersive and minimal story collection.",
    sourceTruth: {
      repositoryCommit: "91d21fc8795a7926da1b865f38cdc6ab4e39619f",
      routeReview: "Current origin/main route implementations and public copy reviewed on 2026-08-10.",
      productPriceClaimsUsed: false,
      clinicalClaimsUsed: false,
    },
    sourceAsset: {
      path: "source/immersive-master-field-imagegen.png",
      sha256: sourceHash,
      generationRoute: "built-in-imagegen",
      role: "Text-free campaign master field; deterministic SVG composition provides all visible copy and service motifs.",
    },
    creativeDirection: {
      format: "1080x1920 story",
      mode: "dark",
      safeAreas: { topPx: 220, sidePx: 120, bottomPx: 300 },
      embeddedUrls: false,
      note: "One service truth per frame. No product, price, retailer, stock, medical, or performance claim is implied.",
    },
    channels: ["whatsapp-status", "instagram-stories", "snapchat"],
    services: outputs.map(({ service, outputName, width, height, sha256: hash }) => ({
      id: service.id,
      status: "draft",
      targetPath: service.targetPath,
      targetUrl: `https://www.jelocare.com${service.targetPath}`,
      copy: {
        eyebrow: service.eyebrow,
        headline: service.headline.join(" "),
        body: service.body.join(" "),
        action: service.action,
        disclaimer: service.disclaimer ?? "Clear context, one step at a time.",
        embeddedUrl: null,
      },
      caption: `${service.headline.join(" ")} ${service.body.join(" ")} Open through the JeloCare link.`,
      creative: [{
        mode: "dark",
        path: outputName,
        width,
        height,
        sha256: hash,
        generationRoute: "built-in-imagegen-master-plus-deterministic-sharp-svg-composition",
      }],
      publication: [],
    })),
    publication: [],
  };

  await writeFile(path.join(directory, "campaign.json"), `${JSON.stringify(campaign, null, 2)}\n`);
  await writeFile(
    path.join(directory, "CAPTIONS.md"),
    `# JeloCare public services campaign captions\n\nStatus: **draft**. Add the recorded target link through the platform. Do not publish without explicit approval.\n\n${outputs.map(({ service }, index) => `## ${String(index + 1).padStart(2, "0")} · ${service.eyebrow}\n\n${service.headline.join(" ")} ${service.body.join(" ")} Open through the JeloCare link.\n\nTarget: ${service.targetPath}\n`).join("\n")}\n`,
  );

  const checksumEntries = [
    ...outputs.map(({ sha256: hash, outputName }) => `${hash}  ${outputName}`),
    `${sourceHash}  source/immersive-master-field-imagegen.png`,
  ];
  await writeFile(path.join(directory, "SHA256SUMS"), `${checksumEntries.join("\n")}\n`);
}

await build();
