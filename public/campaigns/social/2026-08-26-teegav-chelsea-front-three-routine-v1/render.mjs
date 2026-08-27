import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const sourceRoot = path.resolve(
  root,
  "../2026-08-25-chelsea-sofascore-product-front-three-meme-v5/source",
);
const outputPath = path.join(
  root,
  "final",
  "teegav-chelsea-front-three-routine-feed.png",
);

const toDataUri = async (file) =>
  `data:image/png;base64,${(await fs.readFile(file)).toString("base64")}`;

const [avatar, sofascore] = await Promise.all([
  toDataUri(path.join(sourceRoot, "jelocare-avatar.png")),
  toDataUri(path.join(sourceRoot, "sofascore-chelsea-front-three-user-supplied.png")),
]);

const width = 1080;
const height = 1350;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="routine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbe9e4"/>
      <stop offset="1" stop-color="#f4cfd0"/>
    </linearGradient>
    <filter id="mediaShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000" flood-opacity="0.14"/>
    </filter>
    <filter id="tileShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="9" stdDeviation="10" flood-color="#771f36" flood-opacity="0.12"/>
    </filter>
    <clipPath id="avatarClip"><circle cx="105" cy="83" r="37"/></clipPath>
    <clipPath id="sofaClip"><rect x="76" y="227" width="928" height="496" rx="24"/></clipPath>
  </defs>

  <rect width="1080" height="1350" fill="#ffffff"/>

  <g clip-path="url(#avatarClip)">
    <image x="68" y="46" width="74" height="74" preserveAspectRatio="xMidYMid slice" href="${avatar}"/>
  </g>
  <circle cx="105" cy="83" r="37" fill="none" stroke="#eff3f4" stroke-width="1"/>
  <text x="162" y="94" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="700" fill="#111111">JeloCare</text>

  <text x="76" y="178" font-family="Helvetica Neue, Arial, sans-serif" font-size="44" font-weight="650" letter-spacing="-1.4" fill="#0f1419">Chelsea finally found their front three.</text>

  <g filter="url(#mediaShadow)" clip-path="url(#sofaClip)">
    <rect x="76" y="227" width="928" height="496" rx="24" fill="#1f1f1f"/>
    <image x="76" y="227" width="928" height="496" preserveAspectRatio="xMidYMid meet" href="${sofascore}"/>
  </g>

  <text x="76" y="786" font-family="Helvetica Neue, Arial, sans-serif" font-size="42" font-weight="680" letter-spacing="-1" fill="#0f1419">Your own front three:</text>

  <rect x="76" y="818" width="928" height="456" rx="28" fill="url(#routine)"/>

  <g font-family="Helvetica Neue, Arial, sans-serif" text-anchor="middle">
    <g filter="url(#tileShadow)">
      <rect x="112" y="870" width="248" height="304" rx="28" fill="#fff" fill-opacity="0.88"/>
      <rect x="416" y="870" width="248" height="304" rx="28" fill="#fff" fill-opacity="0.88"/>
      <rect x="720" y="870" width="248" height="304" rx="28" fill="#fff" fill-opacity="0.88"/>
    </g>

    <circle cx="236" cy="955" r="53" fill="#771f36"/>
    <circle cx="540" cy="955" r="53" fill="#771f36"/>
    <circle cx="844" cy="955" r="53" fill="#771f36"/>
    <text x="236" y="971" font-size="42" font-weight="750" fill="#fff">1</text>
    <text x="540" y="971" font-size="42" font-weight="750" fill="#fff">2</text>
    <text x="844" y="971" font-size="42" font-weight="750" fill="#fff">3</text>

    <text x="236" y="1066" font-size="23" font-weight="800" letter-spacing="1.6" fill="#261217">CLEANSE</text>
    <text x="540" y="1066" font-size="23" font-weight="800" letter-spacing="1.3" fill="#261217">MOISTURISE</text>
    <text x="844" y="1066" font-size="23" font-weight="800" letter-spacing="1.4" fill="#261217">PROTECT</text>

    <text x="236" y="1113" font-size="21" fill="#613b45">Cleanser</text>
    <text x="540" y="1113" font-size="21" fill="#613b45">Moisturiser</text>
    <text x="844" y="1113" font-size="21" fill="#613b45">Sunscreen</text>
  </g>

</svg>`;

await sharp(Buffer.from(svg))
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
