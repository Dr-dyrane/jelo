import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const SOURCE = path.join(HERE, "source");
const FINAL = path.join(HERE, "final");
const HIGHLIGHTS = path.join(FINAL, "highlight-starters");
const REEL_FRAMES = path.join(FINAL, "reel-frames");
const PREVIEW = path.join(HERE, "preview");
const HANDOFF = path.join(HERE, "handoff", "day-1");
const HANDOFF_PINNED = path.join(HANDOFF, "01-pinned-posts");
const HANDOFF_STORIES = path.join(HANDOFF, "02-highlight-stories");
const HANDOFF_COVERS = path.join(HANDOFF, "03-highlight-covers");
const FOUNDATION = path.join(
  ROOT,
  "public/campaigns/social/2026-08-25-instagram-foundation-v1/final",
);

const FEED = { width: 1080, height: 1350 };
const STORY = { width: 1080, height: 1920 };
const CAMPAIGN_ID = "2026-08-25-instagram-founding-grid-v1";
const REPOSITORY_COMMIT = "afd643af78d8ab053943738c13d4af56695114cc";
const DATA_CHECKED_AT = "2026-08-25T21:38:23Z";
const TIMELY_UNTIL = "2026-08-26T09:32:02Z";

const SOURCE_FILES = {
  anua: "anua-niacinamide-10-txa-4-serum.png",
  anuaStory: "anua-price-story.png",
  cerave: "cerave-foaming-facial-cleanser-236ml.png",
  concernStory: "sensitive-barrier-story.png",
  bundle: "jelocare-bundle-mobile.png",
  consultIntake: "jelocare-consult-intake.png",
  consultResult: "ask-jelocare-result.jpg",
  consultResultCrop: "ask-jelocare-result-guide-crop.jpg",
  order01: "order-01-exact-product-story.jpg",
  order02: "order-02-start-shopping-story.jpg",
  order03: "order-03-keep-shopping-story.jpg",
  order05: "order-05-contact-story.jpg",
  order06: "order-06-delivery-story.jpg",
};

const FONT_FILES = {
  manropeRegular: path.join(
    ROOT,
    "app/(site)/share/[slug]/_og/manrope-400.ttf",
  ),
  manropeSemibold: path.join(
    ROOT,
    "app/(site)/share/[slug]/_og/manrope-600.ttf",
  ),
  italiana: path.join(
    ROOT,
    "app/(site)/share/[slug]/_og/italiana-400.ttf",
  ),
};

const C = {
  ink: "#2d211f",
  muted: "#796b66",
  cream: "#fbf3ed",
  paper: "#fffdf9",
  peach: "#f4d4c5",
  blush: "#f7dfdc",
  rose: "#e8bbb4",
  wine: "#6b3b35",
  deepWine: "#311017",
  black: "#070507",
  darkPaper: "#171214",
  porcelain: "#fff7f4",
  darkMuted: "#c6b0ad",
  pink: "#ff9aa5",
  green: "#4f775f",
};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fontFace(name, weight, base64) {
  return (
    "@font-face{font-family:'" +
    name +
    "';font-style:normal;font-weight:" +
    weight +
    ";src:url(data:font/ttf;base64," +
    base64 +
    ") format('truetype');}\n"
  );
}

function svgDocument(size, body, fonts, extraDefs) {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      size.width +
      '" height="' +
      size.height +
      '" viewBox="0 0 ' +
      size.width +
      " " +
      size.height +
      '"><defs><style>' +
      fontFace("ManropeCampaign", 400, fonts.manropeRegular) +
      fontFace("ManropeCampaign", 600, fonts.manropeSemibold) +
      fontFace("ItalianaCampaign", 400, fonts.italiana) +
      "text{text-rendering:geometricPrecision}</style>" +
      (extraDefs || "") +
      "</defs>" +
      body +
      "</svg>",
  );
}

function wordmark(x, y, color, size, anchor) {
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" text-anchor="' +
    (anchor || "start") +
    '" fill="' +
    color +
    '" font-family="Georgia,Times New Roman,serif" font-size="' +
    (size || 29) +
    '" letter-spacing="5.2">JELOCARE</text>'
  );
}

function label(x, y, value, color, anchor) {
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" text-anchor="' +
    (anchor || "start") +
    '" fill="' +
    color +
    '" font-family="ManropeCampaign" font-size="16" font-weight="600" letter-spacing="4.2">' +
    escapeXml(value) +
    "</text>"
  );
}

function lineText(x, y, lines, options) {
  const o = options || {};
  const family = o.family || "ManropeCampaign";
  const size = o.size || 44;
  const weight = o.weight || 400;
  const leading = o.leading || Math.round(size * 1.18);
  const color = o.color || C.ink;
  const anchor = o.anchor || "start";
  const letterSpacing = o.letterSpacing || 0;
  const spans = lines
    .map(function (line, index) {
      return (
        '<tspan x="' +
        x +
        '" dy="' +
        (index === 0 ? 0 : leading) +
        '">' +
        escapeXml(line) +
        "</tspan>"
      );
    })
    .join("");
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" text-anchor="' +
    anchor +
    '" fill="' +
    color +
    '" font-family="' +
    family +
    '" font-size="' +
    size +
    '" font-weight="' +
    weight +
    '" letter-spacing="' +
    letterSpacing +
    '">' +
    spans +
    "</text>"
  );
}

function arrow(x, y, color) {
  return (
    '<path d="M' +
    x +
    " " +
    y +
    'h30m-11-11 11 11-11 11" fill="none" stroke="' +
    color +
    '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
  );
}

function pill(x, y, width, textValue, fill, color) {
  return (
    '<g><rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    width +
    '" height="48" rx="24" fill="' +
    fill +
    '"/><text x="' +
    (x + width / 2) +
    '" y="' +
    (y + 31) +
    '" text-anchor="middle" fill="' +
    color +
    '" font-family="ManropeCampaign" font-size="15" font-weight="600" letter-spacing="1.2">' +
    escapeXml(textValue) +
    "</text></g>"
  );
}

function phoneFrame(x, y, width, height, image, id, frameColor) {
  const inset = 12;
  const radius = 48;
  return (
    '<g filter="url(#shadow-' +
    id +
    ')"><rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    width +
    '" height="' +
    height +
    '" rx="' +
    radius +
    '" fill="' +
    frameColor +
    '"/><g clip-path="url(#clip-' +
    id +
    ')"><image x="' +
    (x + inset) +
    '" y="' +
    (y + inset) +
    '" width="' +
    (width - inset * 2) +
    '" height="' +
    (height - inset * 2) +
    '" href="' +
    image +
    '" preserveAspectRatio="xMidYMin slice"/></g><rect x="' +
    (x + inset) +
    '" y="' +
    (y + inset) +
    '" width="' +
    (width - inset * 2) +
    '" height="' +
    (height - inset * 2) +
    '" rx="' +
    (radius - inset) +
    '" fill="none" stroke="#fff" stroke-opacity=".35"/></g>'
  );
}

function phoneDefs(x, y, width, height, id) {
  return (
    '<clipPath id="clip-' +
    id +
    '"><rect x="' +
    (x + 12) +
    '" y="' +
    (y + 12) +
    '" width="' +
    (width - 24) +
    '" height="' +
    (height - 24) +
    '" rx="36"/></clipPath><filter id="shadow-' +
    id +
    '" x="-35%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="#000" flood-opacity=".28"/></filter>'
  );
}

function marketPost(fonts, assets) {
  const defs =
    '<radialGradient id="marketGlow" cx="75%" cy="15%" r="90%"><stop offset="0" stop-color="#7d2e47" stop-opacity=".76"/><stop offset=".48" stop-color="#321019" stop-opacity=".65"/><stop offset="1" stop-color="#070507" stop-opacity="0"/></radialGradient><filter id="productShadow" x="-40%" y="-30%" width="180%" height="190%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000" flood-opacity=".35"/></filter>';
  const body =
    '<rect width="1080" height="1350" fill="' +
    C.black +
    '"/><rect width="1080" height="1350" fill="url(#marketGlow)"/>' +
    wordmark(72, 92, C.porcelain) +
    label(1008, 92, "MARKET CHECK", C.pink, "end") +
    lineText(72, 220, ["Same product.", "₦28,226 apart."], {
      family: "ItalianaCampaign",
      size: 86,
      leading: 90,
      color: C.porcelain,
      letterSpacing: -1.2,
    }) +
    lineText(74, 402, ["4 observed stores · 24 Aug 2026"], {
      size: 23,
      color: C.darkMuted,
    }) +
    '<rect x="70" y="488" width="940" height="610" rx="58" fill="' +
    C.darkPaper +
    '" fill-opacity=".92"/><circle cx="540" cy="774" r="214" fill="#f2c8cb" fill-opacity=".13"/><g filter="url(#productShadow)"><image x="335" y="510" width="410" height="530" href="' +
    assets.anua +
    '" preserveAspectRatio="xMidYMid meet"/></g>' +
    '<g><rect x="94" y="762" width="256" height="178" rx="34" fill="#241b1d"/>' +
    label(124, 808, "LOWEST OBSERVED", C.pink) +
    lineText(124, 866, ["₦7,999"], {
      size: 42,
      weight: 600,
      color: C.porcelain,
    }) +
    lineText(124, 908, ["one listing"], {
      size: 17,
      color: C.darkMuted,
    }) +
    '</g><g><rect x="730" y="762" width="256" height="178" rx="34" fill="#241b1d"/>' +
    label(956, 808, "HIGHEST OBSERVED", C.pink, "end") +
    lineText(956, 866, ["₦36,225"], {
      size: 42,
      weight: 600,
      color: C.porcelain,
      anchor: "end",
    }) +
    lineText(956, 908, ["one listing"], {
      size: 17,
      color: C.darkMuted,
      anchor: "end",
    }) +
    "</g>" +
    lineText(72, 1192, ["Compare current listings."], {
      size: 28,
      weight: 600,
      color: C.porcelain,
    }) +
    lineText(72, 1235, ["Prices change. A listing is not proof it is genuine."], {
      size: 18,
      color: C.darkMuted,
    }) +
    lineText(72, 1295, ["jelocare.com/share"], {
      size: 21,
      weight: 600,
      color: C.porcelain,
    }) +
    arrow(930, 1287, C.pink);
  return svgDocument(FEED, body, fonts, defs);
}

function productPost(fonts, assets) {
  const defs =
    '<linearGradient id="productField" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf3ed"/><stop offset=".56" stop-color="#f5d8cc"/><stop offset="1" stop-color="#fffdf9"/></linearGradient><filter id="ceraveShadow" x="-40%" y="-30%" width="180%" height="190%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#70473d" flood-opacity=".2"/></filter>';
  const body =
    '<rect width="1080" height="1350" fill="url(#productField)"/>' +
    wordmark(72, 92, C.ink) +
    label(1008, 92, "PRODUCT FILE", C.wine, "end") +
    lineText(72, 216, ["CeraVe"], {
      family: "ItalianaCampaign",
      size: 94,
      color: C.ink,
      letterSpacing: -1.2,
    }) +
    lineText(74, 294, ["Foaming Facial Cleanser · 236 ml"], {
      size: 25,
      weight: 600,
      color: C.wine,
    }) +
    '<rect x="70" y="366" width="430" height="740" rx="58" fill="#fffdf9" fill-opacity=".72"/><ellipse cx="285" cy="1000" rx="142" ry="32" fill="#6b3b35" fill-opacity=".12"/><g filter="url(#ceraveShadow)"><image x="104" y="430" width="362" height="550" href="' +
    assets.cerave +
    '" preserveAspectRatio="xMidYMid meet"/></g>' +
    pill(138, 1016, 294, "FACE · CLEANSE", C.deepWine, C.porcelain) +
    '<rect x="532" y="366" width="478" height="740" rx="58" fill="' +
    C.paper +
    '" fill-opacity=".82"/>' +
    label(584, 426, "ON THE LABEL", C.wine) +
    lineText(584, 486, ["For normal to oily skin."], {
      size: 29,
      weight: 600,
      color: C.ink,
    }) +
    '<path d="M584 530h374" stroke="#6b3b35" stroke-opacity=".18"/>' +
    label(584, 584, "INGREDIENTS PRESENT", C.wine) +
    lineText(584, 642, ["Niacinamide", "Ceramides NP, AP + EOP", "Hyaluronic acid"], {
      size: 27,
      leading: 48,
      color: C.ink,
    }) +
    '<path d="M584 806h374" stroke="#6b3b35" stroke-opacity=".18"/>' +
    label(584, 860, "HOW TO USE", C.wine) +
    lineText(584, 918, ["Massage onto damp skin,", "rinse, and avoid", "over-cleansing."], {
      size: 26,
      leading: 42,
      color: C.ink,
    }) +
    lineText(72, 1198, ["Identity and care context—not a personal recommendation."], {
      size: 21,
      color: C.muted,
    }) +
    lineText(72, 1289, ["jelocare.com/products"], {
      size: 21,
      weight: 600,
      color: C.ink,
    }) +
    arrow(930, 1281, C.wine);
  return svgDocument(FEED, body, fonts, defs);
}

function concernPost(fonts) {
  const defs =
    '<radialGradient id="concernGlow" cx="12%" cy="4%" r="105%"><stop offset="0" stop-color="#7c3446" stop-opacity=".84"/><stop offset=".46" stop-color="#351018" stop-opacity=".78"/><stop offset="1" stop-color="#090507"/></radialGradient>';
  const body =
    '<rect width="1080" height="1350" fill="url(#concernGlow)"/>' +
    wordmark(72, 92, C.porcelain) +
    label(1008, 92, "CONCERN GUIDE", C.pink, "end") +
    lineText(72, 224, ["When skin feels", "easily unsettled."], {
      family: "ItalianaCampaign",
      size: 78,
      leading: 84,
      color: C.porcelain,
      letterSpacing: -1,
    }) +
    lineText(74, 392, ["Stinging · tightness · flaking · reactivity"], {
      size: 22,
      color: C.darkMuted,
    }) +
    '<rect x="70" y="472" width="940" height="222" rx="48" fill="' +
    C.paper +
    '" fill-opacity=".96"/>' +
    label(118, 530, "KEEP THE ROUTINE QUIET", C.wine) +
    lineText(118, 592, ["Pause new actives. Cleanse gently.", "Add one simple moisturiser."], {
      size: 30,
      leading: 48,
      color: C.ink,
    }) +
    '<rect x="70" y="724" width="940" height="222" rx="48" fill="#f4d4c5"/>' +
    label(118, 782, "WHAT MAY HELP", C.wine) +
    lineText(118, 846, ["Glycerin · ceramides · panthenol", "Fragrance-free moisturiser"], {
      size: 30,
      leading: 48,
      color: C.ink,
    }) +
    '<rect x="70" y="976" width="940" height="194" rx="48" fill="#491820"/>' +
    label(118, 1034, "URGENT CARE", C.pink) +
    lineText(118, 1092, ["Facial swelling, blistering, breathing difficulty", "or a fast-spreading rash needs urgent care."], {
      size: 24,
      leading: 39,
      color: C.porcelain,
    }) +
    lineText(72, 1242, ["Guidance, not a diagnosis."], {
      size: 20,
      color: C.darkMuted,
    }) +
    lineText(72, 1295, ["jelocare.com/concerns/sensitive-barrier"], {
      size: 20,
      weight: 600,
      color: C.porcelain,
    }) +
    arrow(930, 1287, C.pink);
  return svgDocument(FEED, body, fonts, defs);
}

function bundleCover(fonts, assets) {
  const x = 296;
  const y = 466;
  const w = 488;
  const h = 760;
  const defs =
    '<radialGradient id="bundleGlow" cx="76%" cy="18%" r="100%"><stop offset="0" stop-color="#681f3b" stop-opacity=".85"/><stop offset=".48" stop-color="#270b13" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
    phoneDefs(x, y, w, h, "bundle");
  const body =
    '<rect width="1080" height="1350" fill="' +
    C.black +
    '"/><rect width="1080" height="1350" fill="url(#bundleGlow)"/>' +
    wordmark(72, 92, C.porcelain) +
    label(1008, 92, "REEL", C.pink, "end") +
    lineText(72, 214, ["One store.", "One clean path."], {
      family: "ItalianaCampaign",
      size: 78,
      leading: 82,
      color: C.porcelain,
      letterSpacing: -1,
    }) +
    lineText(74, 382, ["Find → one retailer → request quote"], {
      size: 23,
      color: C.darkMuted,
    }) +
    phoneFrame(x, y, w, h, assets.bundle, "bundle", C.darkPaper) +
    '<circle cx="540" cy="846" r="58" fill="' +
    C.pink +
    '" fill-opacity=".94"/><path d="M522 814 570 846 522 878Z" fill="' +
    C.ink +
    '"/>' +
    lineText(72, 1295, ["jelocare.com/bundle"], {
      size: 21,
      weight: 600,
      color: C.porcelain,
    }) +
    arrow(930, 1287, C.pink);
  return svgDocument(FEED, body, fonts, defs);
}

function askIntakePost(fonts, assets) {
  const x = 278;
  const y = 448;
  const w = 524;
  const h = 744;
  const defs =
    '<linearGradient id="askField" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf3ed"/><stop offset=".52" stop-color="#f1cfca"/><stop offset="1" stop-color="#fffdf9"/></linearGradient>' +
    phoneDefs(x, y, w, h, "askintake");
  const body =
    '<rect width="1080" height="1350" fill="url(#askField)"/>' +
    wordmark(72, 92, C.ink) +
    label(1008, 92, "ASK JELOCARE · 1/2", C.wine, "end") +
    lineText(72, 216, ["Describe it in", "your own words."], {
      family: "ItalianaCampaign",
      size: 78,
      leading: 82,
      color: C.ink,
      letterSpacing: -1,
    }) +
    lineText(74, 382, ["No quiz language. No diagnosis."], {
      size: 23,
      color: C.muted,
    }) +
    phoneFrame(x, y, w, h, assets.consultIntake, "askintake", C.paper) +
    lineText(72, 1295, ["Swipe to see the guide →"], {
      size: 21,
      weight: 600,
      color: C.ink,
    });
  return svgDocument(FEED, body, fonts, defs);
}

function askResultPost(fonts, assets) {
  const defs =
    '<linearGradient id="answerField" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#170f12"/><stop offset=".56" stop-color="#32151b"/><stop offset="1" stop-color="#070507"/></linearGradient><clipPath id="resultClip"><rect x="70" y="480" width="940" height="343" rx="46"/></clipPath><filter id="resultShadow" x="-25%" y="-40%" width="150%" height="190%"><feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#000" flood-opacity=".42"/></filter>';
  const body =
    '<rect width="1080" height="1350" fill="url(#answerField)"/>' +
    wordmark(72, 92, C.porcelain) +
    label(1008, 92, "ASK JELOCARE · 2/2", C.pink, "end") +
    lineText(72, 216, ["A sourced guide,", "built from your words."], {
      family: "ItalianaCampaign",
      size: 74,
      leading: 80,
      color: C.porcelain,
      letterSpacing: -1,
    }) +
    lineText(74, 382, ["Real result from the public consultation flow."], {
      size: 22,
      color: C.darkMuted,
    }) +
    '<g filter="url(#resultShadow)"><rect x="70" y="480" width="940" height="343" rx="46" fill="' +
    C.darkPaper +
    '"/><g clip-path="url(#resultClip)"><image x="70" y="480" width="940" height="343" href="' +
    assets.consultResultCrop +
    '" preserveAspectRatio="xMidYMid meet"/></g></g>' +
    '<rect x="70" y="862" width="940" height="180" rx="42" fill="#4a1a23"/>' +
    lineText(112, 922, ["Your words stay visible."], {
      size: 24,
      weight: 600,
      color: C.porcelain,
    }) +
    lineText(112, 972, ["Care steps, products to review and safety boundaries follow."], {
      size: 20,
      color: C.darkMuted,
    }) +
    lineText(112, 1010, ["Guidance—not diagnosis."], {
      size: 18,
      color: C.darkMuted,
    }) +
    lineText(72, 1295, ["jelocare.com/consult"], {
      size: 21,
      weight: 600,
      color: C.porcelain,
    }) +
    arrow(930, 1287, C.pink);
  return svgDocument(FEED, body, fonts, defs);
}

function memePost(fonts, assets, second) {
  const base =
    '<rect width="1080" height="1350" fill="' +
    (second ? C.cream : C.paper) +
    '"/>' +
    wordmark(72, 92, C.ink) +
    label(1008, 92, second ? "2/2" : "1/2", C.wine, "end");
  if (!second) {
    return svgDocument(
      FEED,
      base +
        lineText(72, 238, ['Me checking "just', 'one more shop".'], {
          family: "ItalianaCampaign",
          size: 88,
          leading: 94,
          color: C.ink,
          letterSpacing: -1,
        }) +
        '<rect x="70" y="504" width="940" height="610" rx="58" fill="' +
        C.blush +
        '"/><image x="290" y="554" width="500" height="500" href="' +
        assets.anua +
        '" preserveAspectRatio="xMidYMid meet"/>' +
        lineText(72, 1248, ["Swipe."], {
          size: 25,
          weight: 600,
          color: C.wine,
        }),
      fonts,
      "",
    );
  }
  return svgDocument(
    FEED,
    base +
      lineText(72, 224, ["Shop 1,"], {
        family: "ItalianaCampaign",
        size: 102,
        color: C.ink,
      }) +
      lineText(72, 330, ["I’m back."], {
        family: "ItalianaCampaign",
        size: 102,
        color: C.wine,
      }) +
      '<rect x="70" y="460" width="940" height="622" rx="58" fill="' +
      C.deepWine +
      '"/><image x="216" y="488" width="648" height="576" href="' +
      assets.anuaStory +
      '" preserveAspectRatio="xMidYMid slice"/>' +
      lineText(72, 1194, ["Compare current listings."], {
        size: 27,
        weight: 600,
        color: C.ink,
      }) +
      lineText(72, 1242, ["Prices change."], {
        size: 19,
        color: C.muted,
      }) +
      lineText(72, 1295, ["jelocare.com/share"], {
        size: 21,
        weight: 600,
        color: C.ink,
      }) +
      arrow(930, 1287, C.wine),
    fonts,
    "",
  );
}

function storyCard(fonts, options) {
  const dark = Boolean(options.dark);
  const background = dark
    ? '<rect width="1080" height="1920" fill="#070507"/><radialGradient id="storyGlow" cx="78%" cy="16%" r="96%"><stop offset="0" stop-color="#69223b" stop-opacity=".82"/><stop offset=".5" stop-color="#2a0c14" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><rect width="1080" height="1920" fill="url(#storyGlow)"/>'
    : '<rect width="1080" height="1920" fill="#fbf3ed"/><circle cx="914" cy="236" r="340" fill="#f4d4c5" fill-opacity=".78"/><circle cx="106" cy="1650" r="300" fill="#e8bbb4" fill-opacity=".34"/>';
  const color = dark ? C.porcelain : C.ink;
  const muted = dark ? C.darkMuted : C.muted;
  const accent = dark ? C.pink : C.wine;
  const body =
    background +
    wordmark(72, 104, color) +
    label(1008, 104, options.kicker, accent, "end") +
    lineText(72, 336, options.title, {
      family: "ItalianaCampaign",
      size: options.titleSize || 92,
      leading: options.titleLeading || 98,
      color,
      letterSpacing: -1.3,
    }) +
    lineText(74, options.supportY || 636, options.support, {
      size: 28,
      leading: 44,
      color: muted,
    }) +
    '<rect x="72" y="1010" width="936" height="244" rx="54" fill="' +
    (dark ? C.darkPaper : C.paper) +
    '" fill-opacity=".93"/>' +
    label(120, 1080, options.cardLabel, accent) +
    lineText(120, 1150, options.cardLines, {
      size: 31,
      leading: 46,
      weight: 600,
      color,
    }) +
    lineText(72, 1780, [options.route], {
      size: 25,
      weight: 600,
      color,
    }) +
    lineText(72, 1830, [options.footer || "Guidance, not diagnosis."], {
      size: 18,
      color: muted,
    }) +
    arrow(930, 1771, accent);
  return svgDocument(STORY, body, fonts, dark ? "" : "");
}

function reelOutro(fonts) {
  const body =
    '<rect width="1080" height="1920" fill="' +
    C.black +
    '"/><radialGradient id="outroGlow" cx="74%" cy="20%" r="96%"><stop offset="0" stop-color="#6d263e" stop-opacity=".86"/><stop offset=".48" stop-color="#2b0d16" stop-opacity=".56"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><rect width="1080" height="1920" fill="url(#outroGlow)"/>' +
    wordmark(72, 92, C.porcelain) +
    label(1008, 92, "06 / 06", C.darkMuted, "end") +
    lineText(540, 688, ["Request a", "verified quote."], {
      family: "ItalianaCampaign",
      size: 108,
      leading: 120,
      color: C.porcelain,
      anchor: "middle",
      letterSpacing: -1.2,
    }) +
    '<rect x="242" y="1214" width="596" height="110" rx="55" fill="' +
    C.pink +
    '"/>' +
    lineText(540, 1282, ["Nothing is paid yet."], {
      size: 28,
      weight: 600,
      color: C.ink,
      anchor: "middle",
    }) +
    lineText(540, 1596, ["jelocare.com/bundle"], {
      size: 26,
      weight: 600,
      color: C.porcelain,
      anchor: "middle",
    });
  return svgDocument(STORY, body, fonts, "");
}

function bundleFrameOverlay(fonts, step, total) {
  const current = String(step).padStart(2, "0");
  const count = String(total).padStart(2, "0");
  const dots = Array.from({ length: total }, function (_, index) {
    return (
      '<circle cx="' +
      (96 + index * 32) +
      '" cy="1776" r="6" fill="' +
      (index === step - 1 ? C.pink : "#5c5053") +
      '"/>'
    );
  }).join("");
  const body =
    '<rect x="874" y="62" width="142" height="74" rx="18" fill="#0d0709" fill-opacity=".98"/>' +
    lineText(990, 112, [current + " / " + count], {
      size: 17,
      weight: 600,
      color: C.darkMuted,
      anchor: "end",
      letterSpacing: 3,
    }) +
    '<rect x="0" y="1660" width="1080" height="260" fill="#0a0507"/>' +
    '<path d="M96 1718H984" stroke="#35282c" stroke-width="1"/>' +
    dots +
    lineText(984, 1784, ["SWIPE TO CONTINUE"], {
      size: 16,
      color: C.darkMuted,
      anchor: "end",
      letterSpacing: 2.1,
    }) +
    lineText(96, 1856, ["STEP " + step + " OF " + total + " · REAL GUEST FLOW"], {
      size: 17,
      weight: 600,
      color: C.porcelain,
      letterSpacing: 1.7,
    }) +
    lineText(96, 1894, ["No payment at request."], {
      size: 17,
      color: C.darkMuted,
    });
  return svgDocument(STORY, body, fonts, "");
}

function memeStory(fonts, assets, step) {
  if (step === 2) {
    return svgDocument(
      STORY,
      '<rect width="1080" height="1920" fill="' +
        C.black +
        '"/><image x="0" y="0" width="1080" height="1920" href="' +
        assets.anuaStory +
        '" preserveAspectRatio="xMidYMid slice"/>',
      fonts,
      "",
    );
  }
  const first = step === 1;
  const body =
    '<rect width="1080" height="1920" fill="' +
    C.cream +
    '"/><circle cx="850" cy="330" r="420" fill="' +
    C.peach +
    '" fill-opacity=".9"/>' +
    wordmark(72, 112, C.ink) +
    lineText(72, first ? 476 : 566, first ? ['Me checking "just', 'one more shop".'] : ["Shop 1,", "I’m back."], {
      family: "ItalianaCampaign",
      size: first ? 104 : 128,
      leading: first ? 112 : 140,
      color: first ? C.ink : C.wine,
      letterSpacing: -1.2,
    }) +
    (first
      ? '<image x="232" y="840" width="616" height="616" href="' +
        assets.anua +
        '" preserveAspectRatio="xMidYMid meet"/>'
      : lineText(72, 1114, ["Compare current listings."], {
          size: 32,
          weight: 600,
          color: C.ink,
        }) +
        lineText(72, 1172, ["Prices change."], {
          size: 22,
          color: C.muted,
        })) +
    lineText(72, 1804, ["jelocare.com/share"], {
      size: 26,
      weight: 600,
      color: C.ink,
    });
  return svgDocument(STORY, body, fonts, "");
}

async function renderPng(svg, outputPath) {
  const buffer = await sharp(svg)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await fs.writeFile(outputPath, buffer);
  return { path: outputPath, sha256: sha256(buffer) };
}

async function buildGridPreview(paths) {
  const tiles = await Promise.all(
    paths.map(function (filePath) {
      return sharp(filePath)
        .resize(360, 360, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
    }),
  );
  await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: C.paper,
    },
  })
    .composite(
      tiles.map(function (input, index) {
        return {
          input,
          left: (index % 3) * 360,
          top: Math.floor(index / 3) * 360,
        };
      }),
    )
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW, "founding-grid-square-crop.png"));
}

async function buildContactSheet(paths, outputName, columns, fit) {
  const width = 300;
  const height = 375;
  const gap = 20;
  const rows = Math.ceil(paths.length / columns);
  const inputs = await Promise.all(
    paths.map(function (filePath) {
      return sharp(filePath)
        .resize(width, height, {
          fit: fit || "cover",
          position: "centre",
          background: C.paper,
        })
        .png()
        .toBuffer();
    }),
  );
  await sharp({
    create: {
      width: columns * width + (columns + 1) * gap,
      height: rows * height + (rows + 1) * gap,
      channels: 4,
      background: C.paper,
    },
  })
    .composite(
      inputs.map(function (input, index) {
        return {
          input,
          left: gap + (index % columns) * (width + gap),
          top: gap + Math.floor(index / columns) * (height + gap),
        };
      }),
    )
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW, outputName));
}

async function main() {
  await Promise.all([
    fs.mkdir(FINAL, { recursive: true }),
    fs.mkdir(HIGHLIGHTS, { recursive: true }),
    fs.mkdir(REEL_FRAMES, { recursive: true }),
    fs.mkdir(PREVIEW, { recursive: true }),
    fs.mkdir(HANDOFF_PINNED, { recursive: true }),
    fs.mkdir(HANDOFF_STORIES, { recursive: true }),
    fs.mkdir(HANDOFF_COVERS, { recursive: true }),
  ]);

  const fontBuffers = await Promise.all(
    Object.values(FONT_FILES).map(function (filePath) {
      return fs.readFile(filePath);
    }),
  );
  const fonts = {
    manropeRegular: fontBuffers[0].toString("base64"),
    manropeSemibold: fontBuffers[1].toString("base64"),
    italiana: fontBuffers[2].toString("base64"),
  };

  const assetEntries = await Promise.all(
    Object.entries(SOURCE_FILES).map(async function (entry) {
      const key = entry[0];
      const file = entry[1];
      const buffer = await fs.readFile(path.join(SOURCE, file));
      const mime = file.endsWith(".jpg") ? "image/jpeg" : "image/png";
      return [key, "data:" + mime + ";base64," + buffer.toString("base64")];
    }),
  );
  const assets = Object.fromEntries(assetEntries);

  const feedSpecs = [
    ["04-market-proof-feed.png", marketPost(fonts, assets)],
    ["05-product-file-feed.png", productPost(fonts, assets)],
    ["06-sensitive-barrier-guide-feed.png", concernPost(fonts)],
    ["07-bundle-ordering-reel-cover.png", bundleCover(fonts, assets)],
    ["08-ask-jelocare-demo-01-intake-feed.png", askIntakePost(fonts, assets)],
    ["08-ask-jelocare-demo-02-guide-feed.png", askResultPost(fonts, assets)],
    ["09-timely-meme-01-feed.png", memePost(fonts, assets, false)],
    ["09-timely-meme-02-feed.png", memePost(fonts, assets, true)],
  ];
  const feedResults = [];
  for (const spec of feedSpecs) {
    feedResults.push({
      name: spec[0],
      ...(await renderPng(spec[1], path.join(FINAL, spec[0]))),
    });
  }

  const highlightSpecs = [
    {
      file: "01-start-story.png",
      kicker: "START",
      title: ["Products.", "Prices.", "Clear context."],
      support: ["A calm place to understand", "what is on the shelf."],
      supportY: 690,
      cardLabel: "START HERE",
      cardLines: ["Browse JeloCare"],
      route: "jelocare.com",
      footer: "For Nigerian skincare shoppers.",
      dark: false,
    },
    {
      file: "02-shop-story.png",
      kicker: "SHOP",
      title: ["Build one", "retailer basket."],
      support: ["Choose 2–4 products.", "See exact one-store matches."],
      cardLabel: "NEXT",
      cardLines: ["Request one verified quote"],
      route: "jelocare.com/bundle",
      footer: "No payment when you request.",
      dark: true,
    },
    {
      file: "03-prices-story.png",
      kicker: "PRICES",
      title: ["Compare before", "you commit."],
      support: ["Current observed listings", "from Nigerian stores."],
      cardLabel: "REMEMBER",
      cardLines: ["Prices and stock change"],
      route: "jelocare.com/share",
      footer: "A listing is not proof it is genuine.",
      dark: false,
    },
    {
      file: "04-ask-story.png",
      kicker: "ASK",
      title: ["Tell us what", "you notice."],
      support: ["Get a sourced care guide", "in everyday language."],
      cardLabel: "CARE BOUNDARY",
      cardLines: ["Guidance—not diagnosis"],
      route: "jelocare.com/consult",
      footer: "Urgent symptoms need in-person care.",
      dark: true,
    },
    {
      file: "05-concerns-story.png",
      kicker: "CONCERNS",
      title: ["Start with the", "thing you notice."],
      support: ["Browse reviewed guides", "and practical care context."],
      cardLabel: "BROWSE",
      cardLines: ["Concern guides"],
      route: "jelocare.com/concerns",
      footer: "Clear education. No diagnosis.",
      dark: false,
    },
    {
      file: "06-products-story.png",
      kicker: "PRODUCTS",
      title: ["Know the exact", "product."],
      support: ["Brand, size, care role", "and current store listings."],
      cardLabel: "EXPLORE",
      cardLines: ["The JeloCare catalogue"],
      route: "jelocare.com/products",
      footer: "Product identity before product hype.",
      dark: true,
    },
    {
      file: "07-stores-story.png",
      kicker: "STORES",
      title: ["See who lists", "what."],
      support: ["Retailer pages keep each", "observed listing together."],
      cardLabel: "BROWSE",
      cardLines: ["Observed retailers"],
      route: "jelocare.com/retailers",
      footer: "Listings can change after observation.",
      dark: false,
    },
    {
      file: "08-faq-story.png",
      kicker: "FAQ",
      title: ["How JeloCare", "works."],
      support: ["Prices, ordering and care", "guidance—made plain."],
      cardLabel: "QUICK ANSWER",
      cardLines: ["Start here, then ask us"],
      route: "jelocare.com",
      footer: "Clear enough to use.",
      dark: true,
    },
  ];
  const highlightResults = [];
  for (const spec of highlightSpecs) {
    highlightResults.push({
      name: spec.file,
      ...(await renderPng(
        storyCard(fonts, spec),
        path.join(HIGHLIGHTS, spec.file),
      )),
    });
  }

  const bundleSourceFrames = [
    SOURCE_FILES.order01,
    SOURCE_FILES.order02,
    SOURCE_FILES.order03,
    SOURCE_FILES.order05,
    SOURCE_FILES.order06,
  ];
  const bundleFrameResults = [];
  for (let index = 0; index < bundleSourceFrames.length; index += 1) {
    const name = "bundle-" + String(index + 1).padStart(2, "0") + ".png";
    const outputPath = path.join(REEL_FRAMES, name);
    await sharp(path.join(SOURCE, bundleSourceFrames[index]))
      .resize(STORY.width, STORY.height, { fit: "cover" })
      .composite([
        {
          input: bundleFrameOverlay(
            fonts,
            index + 1,
            bundleSourceFrames.length + 1,
          ),
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    bundleFrameResults.push({
      name,
      path: outputPath,
      sha256: await sha256File(outputPath),
    });
  }
  const bundleOutro = await renderPng(
    reelOutro(fonts),
    path.join(REEL_FRAMES, "bundle-06.png"),
  );
  bundleFrameResults.push({ name: "bundle-06.png", ...bundleOutro });

  const memeFrameResults = [];
  for (const step of [1, 2, 3]) {
    const name = "meme-" + String(step).padStart(2, "0") + ".png";
    memeFrameResults.push({
      name,
      ...(await renderPng(
        memeStory(fonts, assets, step),
        path.join(REEL_FRAMES, name),
      )),
    });
  }

  const foundationPaths = [
    path.join(FOUNDATION, "01-start-here-feed.png"),
    path.join(FOUNDATION, "02-compare-order-feed.png"),
    path.join(FOUNDATION, "03-ask-jelocare-feed.png"),
  ];
  const actualProfileOrder = [
    ...foundationPaths,
    path.join(FINAL, "08-ask-jelocare-demo-02-guide-feed.png"),
    path.join(FINAL, "07-bundle-ordering-reel-cover.png"),
    path.join(FINAL, "06-sensitive-barrier-guide-feed.png"),
    path.join(FINAL, "05-product-file-feed.png"),
    path.join(FINAL, "04-market-proof-feed.png"),
    path.join(FINAL, "09-timely-meme-02-feed.png"),
  ];
  await buildGridPreview(actualProfileOrder);
  await buildContactSheet(
    feedResults.map(function (entry) {
      return entry.path;
    }),
    "remaining-feed-assets.png",
    4,
  );
  await buildContactSheet(
    highlightResults.map(function (entry) {
      return entry.path;
    }),
    "highlight-starters.png",
    4,
    "contain",
  );

  const highlightCoverNames = [
    "01-start.png",
    "02-shop.png",
    "03-prices.png",
    "04-ask.png",
    "05-concerns.png",
    "06-products.png",
    "07-stores.png",
    "08-faq.png",
  ];
  await Promise.all([
    ...foundationPaths.map(function (sourcePath) {
      return fs.copyFile(
        sourcePath,
        path.join(HANDOFF_PINNED, path.basename(sourcePath)),
      );
    }),
    ...highlightResults.map(function (entry) {
      return fs.copyFile(entry.path, path.join(HANDOFF_STORIES, entry.name));
    }),
    ...highlightCoverNames.map(function (name) {
      return fs.copyFile(
        path.join(FOUNDATION, "highlights", name),
        path.join(HANDOFF_COVERS, name),
      );
    }),
  ]);

  const captions =
    "# Instagram founding grid captions\n\n" +
    "## 04 — Market proof\n\n" +
    "The same ANUA Niacinamide 10% + TXA 4% Serum was listed from ₦7,999 to ₦36,225 across 4 observed stores—a ₦28,226 spread.\n\nObserved 24 Aug 2026. Prices and stock change. A listing is not proof it is genuine.\n\nCompare current listings: https://www.jelocare.com/share/anua-niacinamide-10-txa-4-serum\n\n" +
    "Alt: ANUA serum between two observed listing cards showing ₦7,999 and ₦36,225, a ₦28,226 spread across four stores.\n\n" +
    "## 05 — Product File\n\n" +
    "Product File: CeraVe Foaming Facial Cleanser, 236 ml.\n\nThe label positions it for normal to oily skin. The ingredient list includes niacinamide, Ceramides NP/AP/EOP and hyaluronic acid.\n\nMassage onto damp skin, rinse, and avoid over-cleansing. This is product context—not a personal recommendation.\n\nhttps://www.jelocare.com/products/cerave-foaming-facial-cleanser\n\n" +
    "Alt: CeraVe Foaming Facial Cleanser packshot beside concise label, ingredient and use notes.\n\n" +
    "## 06 — Concern guide\n\n" +
    "Stinging, tightness, flaking or reactivity can be a reason to simplify the routine.\n\nWhat may help: glycerin, ceramides, panthenol and a fragrance-free moisturiser.\n\nFacial swelling, blistering, breathing difficulty or a fast-spreading rash needs urgent care. Guidance, not a diagnosis.\n\nhttps://www.jelocare.com/concerns/sensitive-barrier\n\n" +
    "Alt: Sensitive-barrier guide with routine, ingredient and urgent-care sections.\n\n" +
    "## 07 — Bundle ordering Reel\n\n" +
    "Start with the exact product. Keep the basket with one retailer. Add contact and delivery details, then request one verified quote.\n\nNo account is required to start. No payment is taken when you request the quote.\n\nBuild a basket: https://www.jelocare.com/bundle\n\n" +
    "Cover alt: A real JeloCare Bundle Finder screen inside a phone frame with the words One store. One clean path.\n\n" +
    "## 08 — Ask JeloCare carousel\n\n" +
    "Describe what you notice in your own words. JeloCare turns it into a sourced care guide with routine steps, products to review and safety boundaries.\n\nIt is guidance—not a diagnosis. Urgent or worsening symptoms need in-person care.\n\nhttps://www.jelocare.com/consult\n\n" +
    "Alt slide 1: Real mobile Ask JeloCare intake screen. Alt slide 2: Real completed JeloCare guide showing the original prompt and guide heading.\n\n" +
    "## 09 — Timely meme\n\n" +
    'Me checking "just one more shop".\n\nShop 1, I’m back. 😭\n\nCompare current listings: https://www.jelocare.com/share\n\n' +
    "This trend slot expires after 2026-08-26 09:32 UTC and must be revalidated or replaced before later publication.\n";

  const schedule =
    "# Founding grid schedule\n\n" +
    "The three evergreen foundation posts stay pinned. The remaining six appear below them in reverse publication order.\n\n" +
    "| Day | Publish | Gate |\n" +
    "| --- | --- | --- |\n" +
    "| 1 | Start here, Compare + order, Ask JeloCare | Upload in that order; pin Ask, Compare, then Start; verify the visible row is Start · Compare · Ask. |\n" +
    "| 1 | Eight starter Stories; create START, SHOP, PRICES, ASK, CONCERNS, PRODUCTS, STORES, FAQ Highlights | Use the matching approved cover from the foundation packet. |\n" +
    "| 2 | Timely meme carousel or Reel | Publish before the recorded expiry; otherwise replace with that day’s rights-clean trend. |\n" +
    "| 3 | Market proof | Re-fetch the live story and confirm all four figures before posting. |\n" +
    "| 4 | Product File | No price or suitability claim. |\n" +
    "| 5 | Sensitive-barrier guide | Keep the urgent-care boundary visible and in the caption. |\n" +
    "| 7 | Bundle-ordering Reel | Add native Instagram audio at low volume; do not cover UI copy. |\n" +
    "| 9 | Ask JeloCare carousel | Use both slides in order; do not expose a real user or member record. |\n\n" +
    "Profile grid at Day 9: pinned foundation row; Ask · Bundle · Concern; Product · Market · Meme.\n";

  const links =
    "# Instagram profile links\n\n" +
    "Add these in the Instagram mobile app in this order:\n\n" +
    "1. Products — https://www.jelocare.com/products\n" +
    "2. Price watch — https://www.jelocare.com/share\n" +
    "3. Bundle finder — https://www.jelocare.com/bundle\n" +
    "4. Order with JeloCare — https://www.jelocare.com/basket\n" +
    "5. Ask JeloCare — https://www.jelocare.com/consult\n\n" +
    "The fourth link intentionally opens the guest basket. /order is private order tracking and is not the correct acquisition entry point.\n";

  const handoff =
    "# Day 1 mobile handoff\n\n" +
    "Use the Instagram mobile app while signed in as @usejelocare.\n\n" +
    "## Pinned row\n\n" +
    "1. Upload 01-start-here-feed.png, then 02-compare-order-feed.png, then 03-ask-jelocare-feed.png from 01-pinned-posts/.\n" +
    "2. Use the approved captions in the foundation packet.\n" +
    "3. Pin Ask, then Compare, then Start. Confirm the visible row reads Start · Compare · Ask from left to right; if Instagram orders them differently, adjust by visual result.\n\n" +
    "## Highlights\n\n" +
    "1. Upload all eight files in 02-highlight-stories/ as Stories.\n" +
    "2. Create START, SHOP, PRICES, ASK, CONCERNS, PRODUCTS, STORES and FAQ Highlights—one starter Story in each.\n" +
    "3. Edit each Highlight cover with the matching file in 03-highlight-covers/.\n\n" +
    "## Links\n\n" +
    "Add the five links from ../../LINKS.md in the Instagram mobile profile editor, in order.\n\n" +
    "Record each successful post/story identifier in campaign.json; do not record an attempted action as published.\n";

  const sourceAssets = await Promise.all(
    Object.values(SOURCE_FILES).map(async function (file) {
      return {
        path: "source/" + file,
        sha256: await sha256File(path.join(SOURCE, file)),
      };
    }),
  );
  const copyFiles = [
    ["CAPTIONS.md", captions],
    ["SCHEDULE.md", schedule],
    ["LINKS.md", links],
    [path.join("handoff", "day-1", "README.md"), handoff],
  ];
  for (const entry of copyFiles) {
    await fs.writeFile(path.join(HERE, entry[0]), entry[1]);
  }
  const handoffFilePaths = [
    ...foundationPaths.map(function (sourcePath) {
      return path.join(HANDOFF_PINNED, path.basename(sourcePath));
    }),
    ...highlightResults.map(function (entry) {
      return path.join(HANDOFF_STORIES, entry.name);
    }),
    ...highlightCoverNames.map(function (name) {
      return path.join(HANDOFF_COVERS, name);
    }),
    path.join(HANDOFF, "README.md"),
  ];

  const campaign = {
    schemaVersion: 1,
    campaignId: CAMPAIGN_ID,
    status: "draft",
    createdAt: new Date().toISOString(),
    dataCheckedAt: DATA_CHECKED_AT,
    timelyCreativeExpiresAt: TIMELY_UNTIL,
    objective:
      "Complete @usejelocare's nine-post founding grid, eight useful Highlight starters, and a 7–10 day publication sequence without synthetic people, stale checkout prices, or unsupported care claims.",
    sourceTruth: {
      repositoryCommit: REPOSITORY_COMMIT,
      marketEvidence:
        "Fresh JeloCare story render checked 2026-08-25T21:38:22Z: ANUA Niacinamide 10% + TXA 4% Serum, four observed stores, ₦7,999 lowest, ₦36,225 highest, ₦28,226 spread, observed 24 Aug 2026.",
      productEvidence:
        "Released CeraVe Foaming Facial Cleanser 236 ml dossier and canonical 2000×2000 packshot. No Nigerian offer is claimed.",
      concernEvidence:
        "Fresh sensitive-barrier concern story checked 2026-08-25T21:38:23Z; guidance and urgent-care boundary are preserved.",
      interfaceEvidence:
        "Real JeloCare public Bundle Finder, guest ordering and Ask JeloCare surfaces. The completed Ask capture uses a non-sensitive demonstration prompt and no member record.",
      humourEvidence:
        "Rights-clean owned UI adaptation of a currently active Nigerian social return-to-source reaction pattern; no third-party clip, celebrity likeness or copied caption.",
    },
    careBoundary:
      "Guidance, not diagnosis. No personal suitability, treatment, outcome, authenticity or endorsement claim. Urgent boundaries stay visible where relevant.",
    sourceAssets,
    feedCreative: feedResults.map(function (entry) {
      return {
        kind: "instagram-feed",
        path: path.relative(HERE, entry.path),
        width: FEED.width,
        height: FEED.height,
        sha256: entry.sha256,
      };
    }),
    highlightStarters: highlightResults.map(function (entry) {
      return {
        kind: "instagram-story",
        path: path.relative(HERE, entry.path),
        width: STORY.width,
        height: STORY.height,
        sha256: entry.sha256,
      };
    }),
    reelFrames: [...bundleFrameResults, ...memeFrameResults].map(function (entry) {
      return {
        path: path.relative(HERE, entry.path),
        width: STORY.width,
        height: STORY.height,
        sha256: entry.sha256,
      };
    }),
    videoCreative: [],
    profileLinks: [
      ["Products", "https://www.jelocare.com/products"],
      ["Price watch", "https://www.jelocare.com/share"],
      ["Bundle finder", "https://www.jelocare.com/bundle"],
      ["Order with JeloCare", "https://www.jelocare.com/basket"],
      ["Ask JeloCare", "https://www.jelocare.com/consult"],
    ],
    mobileHandoff: {
      path: "handoff/day-1",
      files: await Promise.all(
        handoffFilePaths.map(async function (filePath) {
          return {
            path: path.relative(HERE, filePath),
            sha256: await sha256File(filePath),
          };
        }),
      ),
    },
    publication: [],
  };
  const videoSpecs = [
    ["07-bundle-ordering-reel.mp4", "instagram-reel"],
    ["09-timely-meme-reel.mp4", "instagram-reel"],
  ];
  for (const spec of videoSpecs) {
    const videoPath = path.join(FINAL, spec[0]);
    try {
      const videoStat = await fs.stat(videoPath);
      campaign.videoCreative.push({
        kind: spec[1],
        path: path.relative(HERE, videoPath),
        width: STORY.width,
        height: STORY.height,
        bytes: videoStat.size,
        sha256: await sha256File(videoPath),
        audio: false,
      });
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  await fs.writeFile(
    path.join(HERE, "campaign.json"),
    JSON.stringify(campaign, null, 2) + "\n",
  );

  const checksumTargets = [
    ...feedResults.map(function (entry) {
      return entry.path;
    }),
    ...highlightResults.map(function (entry) {
      return entry.path;
    }),
    ...bundleFrameResults.map(function (entry) {
      return entry.path;
    }),
    ...memeFrameResults.map(function (entry) {
      return entry.path;
    }),
    path.join(PREVIEW, "founding-grid-square-crop.png"),
    path.join(PREVIEW, "remaining-feed-assets.png"),
    path.join(PREVIEW, "highlight-starters.png"),
    path.join(HERE, "CAPTIONS.md"),
    path.join(HERE, "SCHEDULE.md"),
    path.join(HERE, "LINKS.md"),
    ...handoffFilePaths,
    path.join(HERE, "campaign.json"),
    ...sourceAssets.map(function (entry) {
      return path.join(HERE, entry.path);
    }),
  ];
  for (const spec of videoSpecs) {
    const videoPath = path.join(FINAL, spec[0]);
    try {
      await fs.access(videoPath);
      checksumTargets.push(videoPath);
    } catch {}
  }
  const checksumLines = [];
  for (const filePath of checksumTargets) {
    checksumLines.push(
      (await sha256File(filePath)) + "  " + path.relative(HERE, filePath),
    );
  }
  await fs.writeFile(
    path.join(HERE, "SHA256SUMS"),
    checksumLines.join("\n") + "\n",
  );
}

await main();
