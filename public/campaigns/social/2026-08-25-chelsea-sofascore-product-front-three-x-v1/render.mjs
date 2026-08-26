import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const approvedRoot = path.resolve(
  root,
  "../2026-08-25-chelsea-sofascore-product-front-three-meme-v5",
);
const source = (...parts) => path.join(approvedRoot, "source", ...parts);
const outputPath = path.join(
  root,
  "final",
  "chelsea-sofascore-product-front-three-x.png",
);

const toDataUri = async (file) =>
  `data:image/png;base64,${(await fs.readFile(file)).toString("base64")}`;

const [sofascore, cerave, dang, laroche] = await Promise.all([
  toDataUri(source("sofascore-chelsea-front-three-user-supplied.png")),
  toDataUri(source("cerave-foaming-facial-cleanser-236ml.png")),
  toDataUri(source("dang-azelaic-acid-serum-30ml.png")),
  toDataUri(
    source("la-roche-posay-anthelios-uvmune-400-oil-control-fluid-50ml.png"),
  ),
]);

const width = 1080;
const height = 1350;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shelf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbe9e4"/>
      <stop offset="1" stop-color="#f4cfd0"/>
    </linearGradient>
    <filter id="packshotShadow" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="13" stdDeviation="12" flood-color="#5b192b" flood-opacity="0.18"/>
    </filter>
    <filter id="mediaShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000" flood-opacity="0.14"/>
    </filter>
    <clipPath id="sofaClip"><rect x="76" y="48" width="928" height="623" rx="24"/></clipPath>
    <clipPath id="shelfClip"><rect x="50" y="800" width="980" height="500" rx="26"/></clipPath>
  </defs>

  <rect width="1080" height="1350" fill="#ffffff"/>

  <g filter="url(#mediaShadow)" clip-path="url(#sofaClip)">
    <rect x="76" y="48" width="928" height="623" rx="24" fill="#1f1f1f"/>
    <image x="76" y="48" width="928" height="623" preserveAspectRatio="xMidYMid meet" href="${sofascore}"/>
  </g>

  <text x="76" y="760" font-family="Helvetica Neue, Arial, sans-serif" font-size="48" font-weight="680" letter-spacing="-1" fill="#0f1419">We found yours.</text>

  <g clip-path="url(#shelfClip)">
    <rect x="50" y="800" width="980" height="500" rx="26" fill="url(#shelf)"/>
    <ellipse cx="217" cy="1082" rx="126" ry="25" fill="#8a5360" opacity="0.15"/>
    <ellipse cx="540" cy="1077" rx="132" ry="27" fill="#8a5360" opacity="0.15"/>
    <ellipse cx="863" cy="1082" rx="126" ry="25" fill="#8a5360" opacity="0.15"/>

    <g filter="url(#packshotShadow)">
      <image x="77" y="800" width="280" height="280" preserveAspectRatio="xMidYMid meet" href="${cerave}"/>
      <image x="390" y="786" width="300" height="300" preserveAspectRatio="xMidYMid meet" href="${dang}"/>
      <image x="723" y="800" width="280" height="280" preserveAspectRatio="xMidYMid meet" href="${laroche}"/>
    </g>

    <g font-family="Helvetica Neue, Arial, sans-serif" text-anchor="middle">
      <rect x="140" y="1102" width="154" height="38" rx="19" fill="#771f36"/>
      <text x="217" y="1128" font-size="19" font-weight="800" letter-spacing="1.8" fill="#fff">CLEANSE</text>
      <text x="217" y="1172" font-size="26" font-weight="800" fill="#261217">CERAVE</text>
      <text x="217" y="1207" font-size="22" fill="#613b45">Foaming Facial</text>
      <text x="217" y="1235" font-size="22" fill="#613b45">Cleanser</text>
      <text x="217" y="1270" font-size="20" fill="#85636b">236 ml</text>

      <rect x="470" y="1102" width="140" height="38" rx="19" fill="#771f36"/>
      <text x="540" y="1128" font-size="19" font-weight="800" letter-spacing="1.8" fill="#fff">TREAT</text>
      <text x="540" y="1172" font-size="26" font-weight="800" fill="#261217">DANG</text>
      <text x="540" y="1207" font-size="22" fill="#613b45">Azelaic Acid</text>
      <text x="540" y="1235" font-size="22" fill="#613b45">Serum</text>
      <text x="540" y="1270" font-size="20" fill="#85636b">30 ml</text>

      <rect x="782" y="1102" width="162" height="38" rx="19" fill="#771f36"/>
      <text x="863" y="1128" font-size="19" font-weight="800" letter-spacing="1.8" fill="#fff">PROTECT</text>
      <text x="863" y="1172" font-size="24" font-weight="800" fill="#261217">LA ROCHE-POSAY</text>
      <text x="863" y="1207" font-size="21" fill="#613b45">Anthelios UVMune 400</text>
      <text x="863" y="1235" font-size="21" fill="#613b45">Oil Control Fluid SPF50+</text>
      <text x="863" y="1270" font-size="20" fill="#85636b">50 ml</text>
    </g>
  </g>
</svg>`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg))
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
