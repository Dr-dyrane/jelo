import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const source = (...parts) => path.join(root, "source", ...parts);
const outputPath = path.join(
  root,
  "final",
  "chelsea-sofascore-product-front-three-feed.png",
);

const toDataUri = async (file) =>
  `data:image/png;base64,${(await fs.readFile(file)).toString("base64")}`;

const [avatar, verifiedBadge, sofascore, cerave, dang, laroche] =
  await Promise.all([
  toDataUri(source("jelocare-avatar.png")),
  toDataUri(source("verified-badge-user-supplied.png")),
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
    <clipPath id="avatarClip"><circle cx="102" cy="82" r="38"/></clipPath>
    <clipPath id="sofaClip"><rect x="76" y="245" width="928" height="496" rx="24"/></clipPath>
    <clipPath id="shelfClip"><rect x="76" y="825" width="928" height="449" rx="26"/></clipPath>
  </defs>

  <rect width="1080" height="1350" fill="#ffffff"/>

  <g clip-path="url(#avatarClip)">
    <image x="64" y="44" width="76" height="76" preserveAspectRatio="xMidYMid slice" href="${avatar}"/>
  </g>
  <circle cx="102" cy="82" r="38" fill="none" stroke="#eff3f4" stroke-width="1"/>

  <text x="158" y="73" font-family="Helvetica Neue, Arial, sans-serif" font-size="29" font-weight="700" fill="#111111">JeloCare</text>
  <image x="288" y="48" width="28" height="28" preserveAspectRatio="xMidYMid meet" href="${verifiedBadge}" aria-label="Verified account badge"/>
  <text x="158" y="106" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" fill="#536471">@jelocare</text>
  <text x="980" y="78" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="2" fill="#536471">···</text>

  <text x="76" y="190" font-family="Helvetica Neue, Arial, sans-serif" font-size="44" font-weight="650" letter-spacing="-1.4" fill="#0f1419">Chelsea finally found their front three.</text>

  <!-- User-supplied SofaScore crop containing only Chelsea's front three. -->
  <g filter="url(#mediaShadow)" clip-path="url(#sofaClip)">
    <rect x="76" y="245" width="928" height="496" rx="24" fill="#1f1f1f"/>
    <image x="76" y="245" width="928" height="496" preserveAspectRatio="xMidYMid meet" href="${sofascore}"/>
  </g>

  <text x="76" y="802" font-family="Helvetica Neue, Arial, sans-serif" font-size="42" font-weight="680" letter-spacing="-1" fill="#0f1419">We found yours.</text>

  <g clip-path="url(#shelfClip)">
    <rect x="76" y="825" width="928" height="449" rx="26" fill="url(#shelf)"/>
    <ellipse cx="256" cy="1102" rx="118" ry="24" fill="#8a5360" opacity="0.15"/>
    <ellipse cx="540" cy="1096" rx="126" ry="26" fill="#8a5360" opacity="0.15"/>
    <ellipse cx="824" cy="1102" rx="118" ry="24" fill="#8a5360" opacity="0.15"/>

    <g filter="url(#packshotShadow)">
      <image x="128" y="842" width="256" height="256" preserveAspectRatio="xMidYMid meet" href="${cerave}"/>
      <image x="397" y="826" width="286" height="286" preserveAspectRatio="xMidYMid meet" href="${dang}"/>
      <image x="696" y="842" width="256" height="256" preserveAspectRatio="xMidYMid meet" href="${laroche}"/>
    </g>

    <g font-family="Helvetica Neue, Arial, sans-serif" text-anchor="middle">
      <rect x="189" y="1118" width="134" height="32" rx="16" fill="#771f36"/>
      <text x="256" y="1140" font-size="15" font-weight="800" letter-spacing="1.8" fill="#fff">CLEANSE</text>
      <text x="256" y="1176" font-size="17" font-weight="800" fill="#261217">CERAVE</text>
      <text x="256" y="1202" font-size="16" fill="#613b45">Foaming Facial Cleanser</text>
      <text x="256" y="1228" font-size="15" fill="#85636b">236 ml</text>

      <rect x="479" y="1118" width="122" height="32" rx="16" fill="#771f36"/>
      <text x="540" y="1140" font-size="15" font-weight="800" letter-spacing="1.8" fill="#fff">TREAT</text>
      <text x="540" y="1176" font-size="17" font-weight="800" fill="#261217">DANG</text>
      <text x="540" y="1202" font-size="16" fill="#613b45">Azelaic Acid Serum</text>
      <text x="540" y="1228" font-size="15" fill="#85636b">30 ml</text>

      <rect x="755" y="1118" width="138" height="32" rx="16" fill="#771f36"/>
      <text x="824" y="1140" font-size="15" font-weight="800" letter-spacing="1.8" fill="#fff">PROTECT</text>
      <text x="824" y="1176" font-size="17" font-weight="800" fill="#261217">LA ROCHE-POSAY</text>
      <text x="824" y="1202" font-size="15" fill="#613b45">Anthelios UVMune 400</text>
      <text x="824" y="1228" font-size="15" fill="#85636b">SPF50+ · 50 ml</text>
    </g>
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
