import { createHash } from "node:crypto";
import { stableJson } from "@/lib/crypto/hashing";
import { canonicalGtin, isValidGtin } from "./gtin";
import {
  catalogueCanonicalIdentifierFor,
  catalogueGtinForIdentity,
  catalogueOfficialProductCrosswalkValid,
  catalogueOfficialProductCrosswalkKeyGrounded,
  catalogueOfficialProductCrosswalkSchemaVersion,
  normalizedManufacturerSku,
  validManufacturerSku,
  validManufacturerSkuLabel,
  type CatalogueManufacturerSkuLabel,
} from "./canonical-identity";
import {
  catalogueRetainedRecordShapeValid,
  sourceTextNamesCatalogueBrandField,
} from "./retained-record";
import {
  catalogueIdentityExtractionSchemaVersion,
  catalogueBrowserIdentityExtractionSchemaVersion,
  catalogueCorroboratedIdentityExtractionSchemaVersion,
  catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion,
  catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  catalogueRegulatorySearchObservationSchemaVersion,
  reviewedBrowserSurface,
  identifierAbsenceProofValid,
  type CatalogueIntakeCandidate,
  type CatalogueIdentityEvidenceMimeType,
  type CatalogueOfficialIdentityExtraction,
  type CatalogueCorroboratedIdentityExtraction,
  type CatalogueAccessibleCorroboratedIdentityExtraction,
  type CatalogueManufacturerSkuIdentityExtraction,
  type CatalogueOfficialGtinIdentityEvidence,
  type CatalogueOfficialManufacturerSkuIdentityEvidence,
  type CatalogueGenerationRecordContent,
  type CatalogueRegulatorySearchObservation,
} from "./intake-types";

export const hashPattern = /^[0-9a-f]{64}$/;
const regulatorySearchMaxAgeMs = 90 * 24 * 60 * 60 * 1_000;
export const measurableSize =
  /\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l|mg|g|kg|oz|fl\.?\s*oz|count|pcs?|pieces?|pack)\b/i;
const rawIdentityEvidenceMimeTypes: readonly Exclude<
  CatalogueIdentityEvidenceMimeType,
  "application/json"
>[] = [
  "application/pdf",
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/html",
  "text/javascript",
];
export const packshotEligibleOrigins = [
  "licensed-original-photograph",
  "official-brand-media",
  "owned-editorial-photograph",
  "owned-identity-verified-render",
] as const;
const reviewedOfficialCareHosts: Readonly<Record<string, readonly string[]>> = {
  amika: ["loveamika.com"],
  anessa: ["www.shiseido.co.jp"],
  anua: ["anua.com"],
  aveeno: ["www.aveeno.com"],
  aquarich: ["www.aquarich.net"],
  balanceactiveformula: ["www.balanceactiveformula.com"],
  beautyofjoseon: ["beautyofjoseon.com"],
  beautyformulas: ["www.beautyformulas.co.uk"],
  benton: ["bentoncosmetics.com"],
  cerave: ["africa.cerave.com", "www.cerave.com", "www.cerave.co.uk"],
  cecred: ["cecred.com"],
  cosrx: ["www.cosrx.com", "cdn.shopify.com"],
  delacruz: ["dlclabs.com"],
  dang: ["danglifestyle.co", "international.danglifestyle.co"],
  danglifestyle: ["danglifestyle.co", "international.danglifestyle.co"],
  danglifestyleinc: ["danglifestyle.co", "international.danglifestyle.co"],
  dove: ["www.dove.com"],
  drteals: ["www.drteals.com"],
  estelin: ["estelin.co.in"],
  estelinindia: ["estelin.co.in"],
  eos: ["evolutionofsmooth.com"],
  elf: ["www.elfcosmetics.com"],
  eucerin: ["www.eucerin-cewa.com"],
  facefacts: ["facefacts.me"],
  fentyskin: ["fentybeauty.com"],
  garnier: ["www.garnier.co.uk", "www.garnier.com.au"],
  keracare: ["keracare.com"],
  larocheposay: [
    "www.laroche-posay.co.uk",
    "www.laroche-posay.fr",
    "www.laroche-posay.us",
  ],
  loccitaneenprovence: ["no.loccitane.com"],
  medik8: ["www.medik8.com"],
  naturium: ["naturium.com"],
  nivea: ["www.nivea.com.ng"],
  nineless: ["ninelessshop.com", "cdn.shopify.com"],
  ogx: ["www.ogxbeauty.com", "ogxbeauty.com"],
  replenix: ["replenix.com"],
  olay: ["www.olay.com"],
  prequel: ["prequelskin.com", "www.prequelskin.com"],
  sheamoisture: ["www.sheamoisture.com"],
  saltair: ["saltair.com"],
  simple: ["www.simpleskincare.com", "www.simple.co.uk"],
  skinbyzaron: ["www.zaroncosmetics.com"],
  tresemme: ["www.tresemme.com"],
  advancedclinicals: ["advancedclinicals.com"],
  panoxyl: ["panoxyl.com"],
  abib: ["en.abib.com", "cdn.shopify.com"],
  neutrogena: ["www.neutrogena.com"],
};
const reviewedCandidateManufacturerCareUrls: Readonly<
  Record<string, readonly string[]>
> = {
  "balance-salicylic-acid-zinc-clarifying-toner-200ml": [
    "https://www.balanceactiveformula.com/products/balance-active-formula-salicylic-acid-zinc-clarifying-toner-200ml",
  ],
  "cerave-moisturising-cream-454g": [
    "https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream",
  ],
  "cerave-sa-smoothing-cleanser-473ml": [
    "https://www.cerave.co.uk/skincare/cleansers/sa-smoothing-cleanser",
  ],
  "laroche-posay-mela-b3-serum-30ml": [
    "https://www.laroche-posay.co.uk/en_GB/mela-b3-intense-anti-dark-spot-serum/3337875890021.html",
  ],
  "prequel-gleanser-glycolic-acid-cleanser-400ml": [
    "https://prequelskin.com/products/gleanser-glycerin-and-glycolic-acid-cleanser",
  ],
  "tresemme-keratin-smooth-weightless-conditioner-828ml": [
    "https://www.tresemme.com/ca/en/p/tresemm%C3%A9-keratin-smooth-weightless-conditioner.html/00022400011738",
  ],
  "abib-heartleaf-foam-cleanser-150ml": [
    "https://en.abib.com/products/heartleaf-foam",
  ],
  "abib-clear-spot-serum-7-325-30ml": [
    "https://en.abib.com/products/clear-spot-serum-7-325-pump-option",
  ],
  "neutrogena-light-sesame-body-oil-8-5oz": [
    "https://www.neutrogena.com/products/skincare/neutrogena-body-oil-light-sesame-formula-for-dry-skin/6811101",
  ],
  "anua-zero-cast-moisturizing-finish-sunscreen-50ml": [
    "https://anua.com/products/zero-cast-moisturizing-finish-sunscreen",
  ],
  "replenix-bp-10-acne-wash-aloe-vera-7oz": [
    "https://replenix.com/products/bp-10-acne-wash-aloe-vera",
  ],
};
const reviewedOfficialIdentityHosts: Readonly<
  Record<string, readonly string[]>
> = {
  amika: ["loveamika.com", "cdn.shopify.com"],
  anessa: ["www.shiseido.co.jp"],
  anua: ["anua.com"],
  aveeno: ["www.aveeno.com", "images.ctfassets.net"],
  aquarich: ["www.aquarich.net"],
  balanceactiveformula: ["www.balanceactiveformula.com"],
  beautyofjoseon: ["beautyofjoseon.com", "cdn.shopify.com"],
  beautyformulas: ["www.beautyformulas.co.uk"],
  benton: ["bentoncosmetics.com", "cafe24img.poxo.com"],
  cerave: [
    "africa.cerave.com",
    "www.cerave.com",
    "www.cerave.co.uk",
    "uk.lorealdermatologicalbeautypartnershop.com",
  ],
  cecred: ["cecred.com"],
  cosrx: ["www.cosrx.com", "cdn.shopify.com"],
  delacruz: ["dlclabs.com"],
  dang: ["danglifestyle.co", "international.danglifestyle.co"],
  danglifestyle: ["danglifestyle.co", "international.danglifestyle.co"],
  danglifestyleinc: ["danglifestyle.co", "international.danglifestyle.co"],
  dove: ["www.dove.com", "assets.unileversolutions.com"],
  drteals: ["www.drteals.com"],
  estelin: ["estelin.co.in", "cdn.shopify.com"],
  estelinindia: ["estelin.co.in", "cdn.shopify.com"],
  eos: ["evolutionofsmooth.com", "cdn.shopify.com"],
  elf: ["www.elfcosmetics.com", "cdn.shopify.com"],
  eucerin: ["www.eucerin-cewa.com"],
  facefacts: ["facefacts.me"],
  fentyskin: ["fentybeauty.com", "cdn.shopify.com"],
  garnier: ["www.garnier.co.uk", "www.garnier.com.au"],
  keracare: ["keracare.com"],
  larocheposay: [
    "www.laroche-posay.co.uk",
    "www.laroche-posay.fr",
    "www.laroche-posay.us",
    "uk.lorealdermatologicalbeautypartnershop.com",
  ],
  loccitaneenprovence: ["no.loccitane.com", "cdn.shopify.com"],
  medik8: ["www.medik8.com", "cdn.shopify.com"],
  naturium: ["naturium.com", "cdn.shopify.com"],
  nivea: ["www.nivea.com.ng", "img.nivea.com"],
  nineless: ["ninelessshop.com", "cdn.shopify.com"],
  neutrogena: ["www.neutrogena.com", "images.ctfassets.net"],
  ogx: ["www.ogxbeauty.com", "ogxbeauty.com", "images.ctfassets.net"],
  replenix: ["replenix.com"],
  olay: ["www.olay.com"],
  prequel: ["prequelskin.com", "www.prequelskin.com"],
  sheamoisture: ["www.sheamoisture.com", "assets.unileversolutions.com"],
  saltair: ["saltair.com", "cdn.shopify.com"],
  simple: [
    "www.simpleskincare.com",
    "www.simple.co.uk",
    "assets.unileversolutions.com",
  ],
  skinbyzaron: [
    "www.zaroncosmetics.com",
    "zaronproducts.nyc3.cdn.digitaloceanspaces.com",
  ],
  tresemme: ["www.tresemme.com", "assets.unileversolutions.com"],
  advancedclinicals: ["advancedclinicals.com", "cdn.shopify.com"],
  panoxyl: ["panoxyl.com", "www.panoxyl.com"],
  abib: ["en.abib.com", "cdn.shopify.com"],
};
const reviewedCandidateIdentifierCorroborationUrls: Readonly<
  Record<string, readonly string[]>
> = {
  "benton-honest-cleansing-foam-150g": [
    "https://www.miintrade.com/benton/287-benton-honest-cleansing-foam-8809540510251.html",
    "https://www.iherb.com/pr/benton-honest-cleansing-foam-5-29-oz-150-g/74831",
  ],
  "cerave-pm-facial-moisturising-lotion-52ml": [
    "https://www.superdrug.com/skin/face-skin-care/moisturising-lotions/cerave-pm-facial-moisturising-lotion-normal-to-dry-skin-52ml/p/774868",
    "https://www.ebay.co.uk/p/11022362284",
  ],
  "facefacts-vitamin-c-body-lotion-400ml": [
    "https://www.ebay.co.uk/itm/186887831738",
    "https://www.eapollowholesale.co.uk/face-facts-vitamin-c-body-lotion-400ml.html",
  ],
  "nineless-a-control-10-azelaic-acid-serum-30ml": [
    "https://www.happii.dk/Ansigtspleje/Nineless-A-Control-10-Azelaic-Acid-Serum-30-ml/3353734",
    "https://qudobeauty.com/product/nine-less-a-control-10-azelaic-acid-serum-30ml/",
  ],
  "nineless-mela-pro-rice-txa-toner-200ml": [
    "https://qudobeauty.com/product/nineless-mela-pro-rice-txa-toner-200ml/",
    "https://www.shop-apotheke.com/beauty/upmU2WTME/nine-less-mela-pro-rice-txa-face-toner.htm",
  ],
  "nineless-a-control-azelaic-acid-cream-50ml": [
    "https://qudobeauty.com/product/nine-less-a-control-azelaic-acid-cream-50ml/",
    "https://tsmpk.com/nineless-a-control-azelaic-acid-cream-50ml",
  ],
  "elf-suntouchable-invisible-sunscreen-spf-35-50ml": [
    "https://www.amazon.com/dp/B0C7SFTTV3",
    "https://www.upcitemdb.com/upc/609332818071",
  ],
  "skin-by-zaron-vitamin-c-body-wash-650ml": [
    "https://lamifragrance.com/product/skin-by-zaron-vitamin-c-body-wash/",
    "https://www.csigrocery.com/shop/skincare/face/body-face-wash/skin-by-zaron-vitamin-c-body-2/",
  ],
  "facefacts-ceramide-oil-control-foaming-cleanser-400ml": [
    "https://sianwholesale.com/brands/face_facts?p=2",
    "https://www.ebay.co.uk/itm/406162080305",
  ],
  "facefacts-ceramide-hydrating-gentle-cleanser-400ml": [
    "https://lamifragrance.com/product/face-facts-ceramide-hydrating-gentle/",
    "https://www.ebay.co.uk/itm/277901941087",
  ],
  "facefacts-ceramide-foaming-cleanser-400ml": [
    "https://lamifragrance.com/product/face-facts-ceramide-foaming-cleanser/",
    "https://beautyfree.gr/en/gel-foam/38505-face-facts-ceramide-skin-barrier-complex-foaming-cleanser-400ml-5031413936636.html",
  ],
  "facefacts-ceramide-blemish-gel-moisturiser-50ml": [
    "https://sianwholesale.com/face-facts-ceramide-blemish-gel-moisturiser-50ml5031413935691.html",
    "https://lamifragrance.com/product/face-facts-ceramide-blemish-gel-moisturiser/",
  ],
  "facefacts-ceramide-moisturising-gel-cream-50ml": [
    "https://icosmo.com.ua/ru/face-facts/421327",
    "https://skintoc.com/products/face-facts-ceramide-moisturising-gel-cream-50-ml",
  ],
  "facefacts-enhance-gel-cream-cleanser-150ml": [
    "https://store.shure-cosmetics.co.uk/face-facts-enhance-gel-cream-cleanser---150ml-2803-52803-150",
    "https://www.barcodelookup.com/5031413952803",
  ],
  "panoxyl-acne-creamy-wash-4-170g": [
    "https://www.upcitemdb.com/upc/303160227066",
    "https://www.buycott.com/upc/303160227066",
  ],
  "advanced-clinicals-vitamin-c-face-serum-52ml": [
    "https://www.upcitemdb.com/upc/819265008016",
    "https://www.buycott.com/upc/819265008016",
  ],
};
export const reviewedIndependentClinicalGuidanceUrls = new Set([
  "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?audience=consumer&setid=4a1591e8-6135-4b22-b54c-5553c2dc0540",
  "https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=5d501ba0-a6f9-4f0d-86d5-0e8d9302737f",
  "https://www.aad.org/public/diseases/acne/diy/types-breakouts",
  "https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment",
  "https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101",
  "https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer",
  "https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin",
  "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots",
  "https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen",
  "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips",
  "https://www.nhs.uk/tests-and-treatments/emollients/",
  "https://www.nhs.uk/conditions/keratosis-pilaris/",
  "https://www.nhs.uk/medicines/benzoyl-peroxide/about-benzoyl-peroxide/",
  "https://www.nhs.uk/symptoms/body-odour-bo/",
  "https://pubmed.ncbi.nlm.nih.gov/34596890/",
  "https://pubmed.ncbi.nlm.nih.gov/38722460/",
]);

export function catalogueIdentityExtractionCanonicalJson(
  extraction: CatalogueOfficialIdentityExtraction,
) {
  return `${stableJson(extraction)}\n`;
}

function catalogueIdentityExtractionBytes(
  extraction: CatalogueOfficialIdentityExtraction,
) {
  return Buffer.from(
    catalogueIdentityExtractionCanonicalJson(extraction),
    "utf8",
  );
}

export function catalogueIdentityExtractionSha256(
  extraction: CatalogueOfficialIdentityExtraction,
) {
  return createHash("sha256")
    .update(catalogueIdentityExtractionBytes(extraction))
    .digest("hex");
}

export function catalogueIdentityExtractionByteSize(
  extraction: CatalogueOfficialIdentityExtraction,
) {
  return catalogueIdentityExtractionBytes(extraction).byteLength;
}

export function catalogueGenerationRecordSha256(
  record: CatalogueGenerationRecordContent,
) {
  return createHash("sha256")
    .update(`jelocare-catalogue-generation-record-v1\n${stableJson(record)}`)
    .digest("hex");
}

export function validHttps(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validPastDate(value: string | undefined, asOf: number) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) && parsed <= asOf + 5 * 60_000;
}

export function sameGtin(left: string | undefined, right: string | undefined) {
  return Boolean(
    left &&
    right &&
    isValidGtin(left) &&
    isValidGtin(right) &&
    canonicalGtin(left) === canonicalGtin(right),
  );
}

export function regulatorySearchObservationValid(
  candidate: CatalogueIntakeCandidate,
  observation: CatalogueRegulatorySearchObservation,
  asOf: number,
) {
  const retrievedAt = Date.parse(observation.retrievedAt);
  const reviewedAt = Date.parse(observation.reviewedAt);
  const identityCheckedAt = Date.parse(candidate.identity.checkedAt ?? "");
  const expectedQuery = normalized(`${candidate.brand} ${candidate.name}`);
  const source = observation.sourceUrl === "https://www.nafdac.emdex.ng/";
  const response = observation.responseUrl === observation.sourceUrl;
  return (
    observation.schemaVersion ===
      catalogueRegulatorySearchObservationSchemaVersion &&
    observation.authority === "NAFDAC" &&
    observation.method === "reviewed-public-registry-search" &&
    source &&
    response &&
    observation.responseDigestScope === "decoded-response-body" &&
    hashPattern.test(observation.responseSha256) &&
    observation.responseMimeType === "application/json" &&
    Number.isInteger(observation.responseByteSize) &&
    observation.responseByteSize > 0 &&
    observation.query.field === "product-name" &&
    normalized(observation.query.value) === expectedQuery &&
    Number.isInteger(observation.result.recordsTotal) &&
    observation.result.recordsTotal >= 0 &&
    observation.result.recordsFiltered === 0 &&
    observation.result.dataCount === 0 &&
    observation.disposition === "no-active-public-match" &&
    /not proof of non-registration/i.test(observation.caveat) &&
    observation.reviewer.trim().length > 0 &&
    validPastDate(observation.retrievedAt, asOf) &&
    validPastDate(observation.reviewedAt, asOf) &&
    retrievedAt >= identityCheckedAt &&
    reviewedAt >= retrievedAt &&
    asOf - retrievedAt <= regulatorySearchMaxAgeMs
  );
}

export function normalized(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizedSize(value: string) {
  const measurementTokens: string[] = [];
  const remainder = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\b(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/g,
      (_match, rawAmount: string, rawUnit: string) => {
        const amount = Number(rawAmount.replace(",", "."));
        const amountToken = Number.isFinite(amount)
          ? String(amount).replace(".", "d")
          : rawAmount;
        const unitToken = rawUnit
          .replace(/[^a-z]/g, "")
          .replace(/^pieces?$/, "pc")
          .replace(/^pcs?$/, "pc");
        measurementTokens.push(`${amountToken}${unitToken}`);
        return " ";
      },
    );
  return [...measurementTokens.sort(), normalized(remainder)]
    .filter(Boolean)
    .join(" ");
}

export function measurementTokens(value: string) {
  const tokens: string[] = [];
  for (const match of value
    .toLowerCase()
    .matchAll(
      /\b(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/g,
    )) {
    const amount = Number(match[1].replace(",", "."));
    const amountToken = Number.isFinite(amount)
      ? String(amount).replace(".", "d")
      : match[1];
    const unitToken = match[2]
      .replace(/[^a-z]/g, "")
      .replace(/^pieces?$/, "pc")
      .replace(/^pcs?$/, "pc");
    tokens.push(`${amountToken}${unitToken}`);
  }
  return tokens;
}

function identityExtractionFieldValid(
  value: unknown,
): value is { value: string; locator: string; sourceText: string } {
  if (!value || typeof value !== "object") return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.value === "string" &&
    typeof field.locator === "string" &&
    field.locator.trim().length >= 8 &&
    typeof field.sourceText === "string" &&
    field.sourceText.trim().length >= 3
  );
}

function supplementalIdentityResponsesValid(
  candidate: CatalogueIntakeCandidate,
  extraction: CatalogueOfficialIdentityExtraction,
  asOf: number,
) {
  const responses = extraction.supplementalResponses;
  if (responses === undefined) return true;
  if (!Array.isArray(responses) || responses.length < 1 || responses.length > 4)
    return false;

  const sourceUrls = new Set<string>();
  for (const response of responses) {
    if (
      !response ||
      response.role !== "official-pack-image" ||
      !validHttps(response.sourceUrl) ||
      !sameUrl(response.sourceUrl, response.responseUrl) ||
      !reviewedOfficialIdentitySource(candidate, response.sourceUrl) ||
      !validPastDate(response.retrievedAt, asOf) ||
      Date.parse(response.retrievedAt) > Date.parse(extraction.reviewedAt) ||
      !hashPattern.test(response.responseSha256) ||
      !["image/avif", "image/jpeg", "image/png", "image/webp"].includes(
        response.responseMimeType,
      ) ||
      !Number.isSafeInteger(response.responseByteSize) ||
      response.responseByteSize <= 0
    )
      return false;
    sourceUrls.add(new URL(response.sourceUrl).href);
  }
  return sourceUrls.size === responses.length;
}

function sourceTextContainsExactGtin(sourceText: string, gtin: string) {
  const escaped = gtin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`).test(sourceText);
}

function sourceTextContainsExactIdentifier(
  sourceText: string,
  identifier: string,
) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(
    sourceText,
  );
}

function sourceNamesManufacturerSkuLabel(
  sourceText: string,
  label: CatalogueManufacturerSkuLabel,
) {
  const pattern =
    label === "SKU"
      ? /(?:^|[^a-z0-9])sku(?:[^a-z0-9]|$)/i
      : label === "Manufacturer SKU"
        ? /(?:^|[^a-z0-9])manufacturer\s+sku(?:[^a-z0-9]|$)/i
        : /(?:^|[^a-z0-9])product\s+code(?:[^a-z0-9]|$)/i;
  return pattern.test(sourceText);
}

function officialNullIdentifierFieldValid(
  status: CatalogueManufacturerSkuIdentityExtraction["fields"]["gtinPublicationStatus"],
  manufacturerSku: CatalogueManufacturerSkuIdentityExtraction["fields"]["manufacturerSku"],
) {
  const escapedSku = manufacturerSku.value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  return (
    /(?:^|[^a-z0-9])barcode(?:[^a-z0-9]|$)/i.test(status.locator) &&
    /["']?barcode["']?\s*:\s*null/i.test(status.sourceText) &&
    new RegExp(`["']?sku["']?\\s*:\\s*["']${escapedSku}["']`, "i").test(
      status.sourceText,
    )
  );
}

function extractionNamesExplicitManufacturerIdentifier(field: {
  value: string;
  locator: string;
  sourceText: string;
}) {
  const explicitLabel =
    /(?:^|[^a-z0-9])(?:barcode|gtin(?:-?1[234])?|ean(?:-?13)?s?|upc(?:-?[ae])?)(?:[^a-z0-9]|$)/i;
  if (explicitLabel.test(field.locator) || explicitLabel.test(field.sourceText))
    return true;

  // Some reviewed manufacturer pages publish their EAN-shaped identifier as
  // the same SKU and MPN. Requiring both labels keeps a lone retailer SKU or
  // generic product ID from being promoted to canonical identity evidence.
  const escapedValue = field.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(
      `(?:^|[^a-z0-9])sku[^\\n;]{0,40}${escapedValue}(?:\\D|$)`,
      "i",
    ).test(field.sourceText) &&
    new RegExp(
      `(?:^|[^a-z0-9])mpn[^\\n;]{0,40}${escapedValue}(?:\\D|$)`,
      "i",
    ).test(field.sourceText)
  );
}

function sourceTextContainsExactSize(sourceText: string, size: string) {
  const expected = measurementTokens(size);
  const observed = new Set(measurementTokens(sourceText));
  return expected.length > 0 && expected.every((token) => observed.has(token));
}

export function normalizedIdentity(candidate: CatalogueIntakeCandidate) {
  return [
    normalized(candidate.brand),
    normalized(candidate.name),
    normalizedSize(candidate.size),
  ].join("|");
}

export function sameUrl(left: string | undefined, right: string | undefined) {
  if (!validHttps(left) || !validHttps(right)) return false;
  return new URL(left ?? "").href === new URL(right ?? "").href;
}

function canonicalOneHandleProductPath(pathname: string) {
  return /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
}

function exactOfficialManufacturerResponseUrl(
  extraction: CatalogueManufacturerSkuIdentityExtraction,
  officialProductUrl: string,
) {
  if (!sameUrl(extraction.sourceUrl, officialProductUrl)) return false;
  if (extraction.sourceResponseMimeType === "text/html") {
    return sameUrl(extraction.responseUrl, extraction.sourceUrl);
  }
  if (!validHttps(extraction.responseUrl)) return false;
  const source = new URL(extraction.sourceUrl);
  const response = new URL(extraction.responseUrl);
  const productPath = source.pathname.replace(/\/+$/, "");
  const parameters = Array.from(response.searchParams.entries());
  const parameterNames = new Set(parameters.map(([name]) => name));
  const validShopifyLocalization =
    parameters.length === 0 ||
    (parameters.length === 3 &&
      parameterNames.size === 3 &&
      parameterNames.has("country") &&
      parameterNames.has("currency") &&
      parameterNames.has("v") &&
      /^[A-Z]{2}$/.test(response.searchParams.get("country") ?? "") &&
      /^[A-Z]{3}$/.test(response.searchParams.get("currency") ?? "") &&
      /^\d+$/.test(response.searchParams.get("v") ?? ""));
  return (
    source.origin === response.origin &&
    source.search === "" &&
    source.hash === "" &&
    canonicalOneHandleProductPath(productPath) &&
    response.pathname === `${productPath}.js` &&
    response.hash === "" &&
    validShopifyLocalization
  );
}

function manufacturerIdentityCaptureValid(
  extraction: CatalogueManufacturerSkuIdentityExtraction,
) {
  if (
    extraction.sourceResponseMimeType === "application/json" ||
    extraction.sourceResponseMimeType === "text/javascript"
  ) {
    return (
      extraction.responseDigestScope === "decoded-response-body" &&
      extraction.method ===
        "reviewed-exact-official-manufacturer-sku-response" &&
      !Object.prototype.hasOwnProperty.call(extraction, "browserCapture")
    );
  }
  return (
    extraction.responseDigestScope === "rendered-dom-outerhtml" &&
    extraction.method ===
      "reviewed-browser-dom-official-manufacturer-sku-identity" &&
    reviewedBrowserSurface(extraction.browserCapture.surface) &&
    extraction.browserCapture.documentReadyState === "complete" &&
    extraction.browserCapture.pageTitle.trim().length >= 3
  );
}

function sameShopifyMediaRevision(left: string, right: string) {
  if (!validHttps(left) || !validHttps(right)) return false;
  const leftUrl = new URL(left);
  const rightUrl = new URL(right);
  const leftFile = leftUrl.pathname.split("/").at(-1);
  const rightFile = rightUrl.pathname.split("/").at(-1);
  const leftVersion = leftUrl.searchParams.get("v");
  const rightVersion = rightUrl.searchParams.get("v");
  return Boolean(
    leftFile &&
    leftFile === rightFile &&
    leftVersion &&
    leftVersion === rightVersion,
  );
}

function reviewedManufacturerPackageVersionValid(
  candidate: CatalogueIntakeCandidate,
  field: CatalogueManufacturerSkuIdentityExtraction["fields"]["packageVersion"],
) {
  if (normalized(field.sourceText).includes(normalized(field.value)))
    return true;
  const media = field.reviewedMedia;
  return Boolean(
    media &&
    validHttps(media.sourceUrl) &&
    validHttps(media.sourceAssetUrl) &&
    sameUrl(field.sourceText, media.sourceUrl) &&
    sameShopifyMediaRevision(media.sourceUrl, media.sourceAssetUrl) &&
    hashPattern.test(media.sourceAssetSha256) &&
    reviewedOfficialIdentitySource(candidate, media.sourceAssetUrl) &&
    sameUrl(candidate.asset.sourceUrl, media.sourceAssetUrl) &&
    candidate.asset.sourceAssetSha256 === media.sourceAssetSha256,
  );
}

function sameBrandOfficialCareSource(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  if (!validHttps(evidenceUrl)) return false;
  const evidenceHost = new URL(evidenceUrl ?? "").hostname.toLowerCase();
  const brandKey = normalized(candidate.brand).replace(/\s/g, "");
  return reviewedOfficialCareHosts[brandKey]?.includes(evidenceHost) ?? false;
}

export function catalogueBrandAuthorizationSourceValid(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  return (
    validHttps(evidenceUrl) &&
    sameBrandOfficialCareSource(candidate, evidenceUrl) &&
    reviewedOfficialIdentitySource(
      candidate,
      candidate.identity.officialProductUrl,
    )
  );
}

export function candidateScopedManufacturerCareSource(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  if (!sameBrandOfficialCareSource(candidate, evidenceUrl)) return false;
  if (sameUrl(evidenceUrl, candidate.identity.officialProductUrl)) return true;
  return (
    reviewedCandidateManufacturerCareUrls[candidate.id]?.some((url) =>
      sameUrl(url, evidenceUrl),
    ) ?? false
  );
}

function reviewedOfficialIdentitySource(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  if (!validHttps(evidenceUrl)) return false;
  const evidenceHost = new URL(evidenceUrl ?? "").hostname.toLowerCase();
  const brandKey = normalized(candidate.brand).replace(/\s/g, "");
  return (
    reviewedOfficialIdentityHosts[brandKey]?.includes(evidenceHost) ?? false
  );
}

function reviewedIdentifierCorroborationSource(
  candidate: CatalogueIntakeCandidate,
  evidenceUrl: string | undefined,
) {
  if (!validHttps(evidenceUrl)) return false;
  return (
    reviewedCandidateIdentifierCorroborationUrls[candidate.id]?.some((url) =>
      sameUrl(url, evidenceUrl),
    ) ?? false
  );
}

function corroboratedIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  evidence: CatalogueOfficialGtinIdentityEvidence,
  extraction: CatalogueCorroboratedIdentityExtraction,
  asOf: number,
) {
  const checkedAt = Date.parse(candidate.identity.checkedAt ?? "");
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const extractionReviewedAt = Date.parse(extraction.reviewedAt);
  const packageVersion = candidate.identity.packageVersion;
  const identifierStatus = extraction.fields.manufacturerIdentifierStatus;
  const packageVersionField = extraction.fields.packageVersion;
  const compositeGtin = extraction.fields.gtin;
  const officialVariant = extraction.fields.variant;
  const officialSize = extraction.fields.size;
  const observedIdentityName = normalized(
    `${candidate.brand} ${candidate.name}`,
  );
  const officialFieldIdentity = normalized(
    `${candidate.brand} ${officialVariant.value}`,
  );

  if (
    evidence.snapshotKind !== "canonical-extraction" ||
    evidence.snapshotPath !==
      `data/catalogue-identity-evidence/${candidate.id}.json` ||
    evidence.snapshotMimeType !== "application/json" ||
    !reviewedOfficialIdentitySource(candidate, evidence.url) ||
    !sameUrl(evidence.url, candidate.identity.officialProductUrl) ||
    !sameUrl(extraction.sourceUrl, evidence.url) ||
    !sameUrl(extraction.responseUrl, extraction.sourceUrl) ||
    extraction.candidateId !== candidate.id ||
    extraction.responseDigestScope !== "rendered-dom-outerhtml" ||
    extraction.method !==
      "reviewed-browser-dom-identity-with-independent-ean-corroboration" ||
    extraction.sourceResponseMimeType !== "text/html" ||
    !hashPattern.test(extraction.sourceResponseSha256) ||
    !Number.isSafeInteger(extraction.sourceResponseByteSize) ||
    extraction.sourceResponseByteSize <= 0 ||
    !reviewedBrowserSurface(extraction.browserCapture.surface) ||
    extraction.browserCapture.documentReadyState !== "complete" ||
    extraction.browserCapture.pageTitle.trim().length < 3 ||
    extraction.retrievedAt !== evidence.retrievedAt ||
    !validPastDate(extraction.retrievedAt, asOf) ||
    !validPastDate(extraction.reviewedAt, asOf) ||
    !Number.isFinite(checkedAt) ||
    !Number.isFinite(retrievedAt) ||
    !Number.isFinite(extractionReviewedAt) ||
    extractionReviewedAt < retrievedAt ||
    extractionReviewedAt > checkedAt ||
    !identityExtractionFieldValid(officialVariant) ||
    !identityExtractionFieldValid(officialSize) ||
    !identityExtractionFieldValid(compositeGtin) ||
    !identityExtractionFieldValid(identifierStatus) ||
    !identityExtractionFieldValid(packageVersionField) ||
    !extractionNamesExplicitManufacturerIdentifier(compositeGtin) ||
    !sameGtin(compositeGtin.value, evidence.observedGtin) ||
    !sourceTextContainsExactGtin(
      compositeGtin.sourceText,
      compositeGtin.value,
    ) ||
    officialFieldIdentity !== observedIdentityName ||
    !normalized(officialVariant.sourceText).includes(
      normalized(officialVariant.value),
    ) ||
    normalizedSize(officialSize.value) !== normalizedSize(candidate.size) ||
    !sourceTextContainsExactSize(officialSize.sourceText, officialSize.value) ||
    identifierStatus.value !== "not-published" ||
    // Non-publication is proven either by quoting the official empty identifier fields, or by a
    // bound, re-runnable absence search over the same rendered document. Prose alone never passes.
    !(
      (/["']?barcode["']?\s*:\s*null/i.test(identifierStatus.sourceText) &&
        /["']?sku["']?\s*:\s*["']{2}/i.test(identifierStatus.sourceText)) ||
      identifierAbsenceProofValid(identifierStatus.absenceProof, extraction)
    ) ||
    !packageVersion?.trim() ||
    normalized(packageVersionField.value) !== normalized(packageVersion) ||
    normalized(evidence.observedPackageVersion ?? "") !==
      normalized(packageVersion) ||
    !validHttps(packageVersionField.evidenceUrl) ||
    !sameGtin(
      evidence.observedGtin,
      catalogueGtinForIdentity(candidate.identity),
    ) ||
    normalized(evidence.observedVariant) !== normalized(candidate.variant) ||
    normalizedSize(evidence.observedSize) !== normalizedSize(candidate.size) ||
    !hashPattern.test(evidence.snapshotSha256) ||
    !Number.isSafeInteger(evidence.snapshotByteSize) ||
    evidence.snapshotByteSize <= 0 ||
    evidence.snapshotSha256 !== catalogueIdentityExtractionSha256(extraction) ||
    evidence.snapshotByteSize !==
      catalogueIdentityExtractionByteSize(extraction) ||
    !supplementalIdentityResponsesValid(candidate, extraction, asOf) ||
    !extraction.supplementalResponses.some((response) =>
      sameUrl(response.sourceUrl, packageVersionField.evidenceUrl),
    ) ||
    typeof extraction.reviewer !== "string" ||
    extraction.reviewer.trim().length < 2
  )
    return false;

  if (
    !Array.isArray(extraction.identifierCorroborations) ||
    extraction.identifierCorroborations.length < 2 ||
    extraction.identifierCorroborations.length > 3
  )
    return false;

  const sourceUrls = new Set<string>();
  const sourceHosts = new Set<string>();
  const corroboratedBrandNames = [
    candidate.brand,
    ...(candidate.brandAliases ?? []),
  ].map(normalized);
  for (const corroboration of extraction.identifierCorroborations) {
    const corroborationRetrievedAt = Date.parse(corroboration.retrievedAt);
    const corroborationReviewedAt = Date.parse(corroboration.reviewedAt);
    const fields = corroboration.fields;
    if (
      !reviewedIdentifierCorroborationSource(
        candidate,
        corroboration.sourceUrl,
      ) ||
      !sameUrl(corroboration.sourceUrl, corroboration.responseUrl) ||
      corroboration.method !==
        "reviewed-browser-dom-independent-ean-corroboration" ||
      corroboration.responseDigestScope !== "rendered-dom-outerhtml" ||
      corroboration.sourceResponseMimeType !== "text/html" ||
      !hashPattern.test(corroboration.sourceResponseSha256) ||
      !Number.isSafeInteger(corroboration.sourceResponseByteSize) ||
      corroboration.sourceResponseByteSize <= 0 ||
      !reviewedBrowserSurface(corroboration.browserCapture.surface) ||
      corroboration.browserCapture.documentReadyState !== "complete" ||
      corroboration.browserCapture.pageTitle.trim().length < 3 ||
      !validPastDate(corroboration.retrievedAt, asOf) ||
      !validPastDate(corroboration.reviewedAt, asOf) ||
      !Number.isFinite(corroborationRetrievedAt) ||
      !Number.isFinite(corroborationReviewedAt) ||
      corroborationReviewedAt < corroborationRetrievedAt ||
      corroborationReviewedAt > checkedAt ||
      !identityExtractionFieldValid(fields.gtin) ||
      !identityExtractionFieldValid(fields.variant) ||
      !identityExtractionFieldValid(fields.size) ||
      !extractionNamesExplicitManufacturerIdentifier(fields.gtin) ||
      !sameGtin(fields.gtin.value, evidence.observedGtin) ||
      !sourceTextContainsExactGtin(fields.gtin.sourceText, fields.gtin.value) ||
      !corroboratedBrandNames.some((brand) =>
        normalized(fields.variant.value).includes(brand),
      ) ||
      !normalized(fields.variant.value).includes(normalized(candidate.name)) ||
      !normalized(fields.variant.sourceText).includes(
        normalized(fields.variant.value),
      ) ||
      normalizedSize(fields.size.value) !== normalizedSize(candidate.size) ||
      !sourceTextContainsExactSize(fields.size.sourceText, fields.size.value) ||
      typeof corroboration.reviewer !== "string" ||
      corroboration.reviewer.trim().length < 2
    )
      return false;

    const url = new URL(corroboration.sourceUrl);
    sourceUrls.add(url.href);
    sourceHosts.add(url.hostname.replace(/^www\./, "").toLowerCase());
  }
  return (
    sourceUrls.size === extraction.identifierCorroborations.length &&
    sourceHosts.size === extraction.identifierCorroborations.length
  );
}

function accessibleCorroboratedIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  evidence: CatalogueOfficialGtinIdentityEvidence,
  extraction: CatalogueAccessibleCorroboratedIdentityExtraction,
  asOf: number,
) {
  const checkedAt = Date.parse(candidate.identity.checkedAt ?? "");
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const extractionReviewedAt = Date.parse(extraction.reviewedAt);
  const packageVersion = candidate.identity.packageVersion;
  const packageVersionField = extraction.fields.packageVersion;
  const compositeGtin = extraction.fields.gtin;
  const officialVariant = extraction.fields.variant;
  const officialSize = extraction.fields.size;
  const observedIdentityName = normalized(
    `${candidate.brand} ${candidate.name}`,
  );
  const officialFieldIdentity = normalized(
    `${candidate.brand} ${officialVariant.value}`,
  );

  if (
    evidence.snapshotKind !== "canonical-extraction" ||
    evidence.snapshotPath !==
      `data/catalogue-identity-evidence/${candidate.id}.json` ||
    evidence.snapshotMimeType !== "application/json" ||
    !reviewedOfficialIdentitySource(candidate, evidence.url) ||
    !sameUrl(evidence.url, candidate.identity.officialProductUrl) ||
    !sameUrl(extraction.sourceUrl, evidence.url) ||
    !sameUrl(extraction.responseUrl, extraction.sourceUrl) ||
    extraction.candidateId !== candidate.id ||
    extraction.responseDigestScope !== "rendered-accessibility-tree" ||
    extraction.method !==
      "reviewed-browser-accessibility-identity-with-independent-ean-corroboration" ||
    extraction.sourceResponseMimeType !== "text/html" ||
    !hashPattern.test(extraction.sourceResponseSha256) ||
    !Number.isSafeInteger(extraction.sourceResponseByteSize) ||
    extraction.sourceResponseByteSize <= 0 ||
    !reviewedBrowserSurface(extraction.browserCapture.surface) ||
    extraction.browserCapture.documentReadyState !== "complete" ||
    extraction.browserCapture.pageTitle.trim().length < 3 ||
    extraction.retrievedAt !== evidence.retrievedAt ||
    !validPastDate(extraction.retrievedAt, asOf) ||
    !validPastDate(extraction.reviewedAt, asOf) ||
    !Number.isFinite(checkedAt) ||
    !Number.isFinite(retrievedAt) ||
    !Number.isFinite(extractionReviewedAt) ||
    extractionReviewedAt < retrievedAt ||
    extractionReviewedAt > checkedAt ||
    !identityExtractionFieldValid(officialVariant) ||
    !identityExtractionFieldValid(officialSize) ||
    !identityExtractionFieldValid(compositeGtin) ||
    !identityExtractionFieldValid(packageVersionField) ||
    !extractionNamesExplicitManufacturerIdentifier(compositeGtin) ||
    !sameGtin(compositeGtin.value, evidence.observedGtin) ||
    !sourceTextContainsExactGtin(
      compositeGtin.sourceText,
      compositeGtin.value,
    ) ||
    officialFieldIdentity !== observedIdentityName ||
    !normalized(officialVariant.sourceText).includes(
      normalized(officialVariant.value),
    ) ||
    normalizedSize(officialSize.value) !== normalizedSize(candidate.size) ||
    !sourceTextContainsExactSize(officialSize.sourceText, officialSize.value) ||
    !packageVersion?.trim() ||
    normalized(packageVersionField.value) !== normalized(packageVersion) ||
    normalized(evidence.observedPackageVersion ?? "") !==
      normalized(packageVersion) ||
    !validHttps(packageVersionField.evidenceUrl) ||
    !sameGtin(
      evidence.observedGtin,
      catalogueGtinForIdentity(candidate.identity),
    ) ||
    normalized(evidence.observedVariant) !== normalized(candidate.variant) ||
    normalizedSize(evidence.observedSize) !== normalizedSize(candidate.size) ||
    !hashPattern.test(evidence.snapshotSha256) ||
    !Number.isSafeInteger(evidence.snapshotByteSize) ||
    evidence.snapshotByteSize <= 0 ||
    evidence.snapshotSha256 !== catalogueIdentityExtractionSha256(extraction) ||
    evidence.snapshotByteSize !==
      catalogueIdentityExtractionByteSize(extraction) ||
    !supplementalIdentityResponsesValid(candidate, extraction, asOf) ||
    !extraction.supplementalResponses.some((response) =>
      sameUrl(response.sourceUrl, packageVersionField.evidenceUrl),
    ) ||
    typeof extraction.reviewer !== "string" ||
    extraction.reviewer.trim().length < 2
  )
    return false;

  if (
    !Array.isArray(extraction.identifierCorroborations) ||
    extraction.identifierCorroborations.length < 2 ||
    extraction.identifierCorroborations.length > 3
  )
    return false;

  const sourceUrls = new Set<string>();
  const sourceHosts = new Set<string>();
  const corroboratedBrandNames = [
    candidate.brand,
    ...(candidate.brandAliases ?? []),
  ].map(normalized);
  const candidateNameTokens = normalized(candidate.name)
    .split(" ")
    .filter((token) => token.length > 2);
  for (const corroboration of extraction.identifierCorroborations) {
    const corroborationRetrievedAt = Date.parse(corroboration.retrievedAt);
    const corroborationReviewedAt = Date.parse(corroboration.reviewedAt);
    const fields = corroboration.fields;
    const corroborationVariant = normalized(fields.variant.value);
    const corroborationVariantTokens = new Set(corroborationVariant.split(" "));
    if (
      !reviewedIdentifierCorroborationSource(
        candidate,
        corroboration.sourceUrl,
      ) ||
      !sameUrl(corroboration.sourceUrl, corroboration.responseUrl) ||
      corroboration.method !==
        "reviewed-browser-accessibility-independent-ean-corroboration" ||
      corroboration.responseDigestScope !== "rendered-accessibility-tree" ||
      corroboration.sourceResponseMimeType !== "text/html" ||
      !hashPattern.test(corroboration.sourceResponseSha256) ||
      !Number.isSafeInteger(corroboration.sourceResponseByteSize) ||
      corroboration.sourceResponseByteSize <= 0 ||
      !reviewedBrowserSurface(corroboration.browserCapture.surface) ||
      corroboration.browserCapture.documentReadyState !== "complete" ||
      corroboration.browserCapture.pageTitle.trim().length < 3 ||
      !validPastDate(corroboration.retrievedAt, asOf) ||
      !validPastDate(corroboration.reviewedAt, asOf) ||
      !Number.isFinite(corroborationRetrievedAt) ||
      !Number.isFinite(corroborationReviewedAt) ||
      corroborationReviewedAt < corroborationRetrievedAt ||
      corroborationReviewedAt > checkedAt ||
      !identityExtractionFieldValid(fields.gtin) ||
      !identityExtractionFieldValid(fields.variant) ||
      !identityExtractionFieldValid(fields.size) ||
      !extractionNamesExplicitManufacturerIdentifier(fields.gtin) ||
      !sameGtin(fields.gtin.value, evidence.observedGtin) ||
      !sourceTextContainsExactGtin(fields.gtin.sourceText, fields.gtin.value) ||
      !corroboratedBrandNames.some((brand) =>
        corroborationVariant.includes(brand),
      ) ||
      !candidateNameTokens.every((token) =>
        corroborationVariantTokens.has(token),
      ) ||
      !normalized(fields.variant.sourceText).includes(corroborationVariant) ||
      normalizedSize(fields.size.value) !== normalizedSize(candidate.size) ||
      !sourceTextContainsExactSize(fields.size.sourceText, fields.size.value) ||
      typeof corroboration.reviewer !== "string" ||
      corroboration.reviewer.trim().length < 2
    )
      return false;

    const url = new URL(corroboration.sourceUrl);
    sourceUrls.add(url.href);
    sourceHosts.add(url.hostname.replace(/^www\./, "").toLowerCase());
  }
  return (
    sourceUrls.size === extraction.identifierCorroborations.length &&
    sourceHosts.size === extraction.identifierCorroborations.length
  );
}

function manufacturerSkuIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  evidence: CatalogueOfficialManufacturerSkuIdentityEvidence,
  extraction: CatalogueManufacturerSkuIdentityExtraction,
  asOf: number,
) {
  const canonicalIdentifier = catalogueCanonicalIdentifierFor(
    candidate.identity,
  );
  const officialProductCrosswalk =
    "officialProductCrosswalk" in candidate.identity
      ? candidate.identity.officialProductCrosswalk
      : undefined;
  const checkedAt = Date.parse(candidate.identity.checkedAt ?? "");
  const retrievedAt = Date.parse(evidence.retrievedAt);
  const reviewedAt = Date.parse(extraction.reviewedAt);
  const manufacturerSku = extraction.fields.manufacturerSku;
  const manufacturerBrand = extraction.fields.manufacturerBrand;
  const manufacturerBrandAliases =
    extraction.fields.manufacturerBrandAliases ?? [];
  const variant = extraction.fields.variant;
  const size = extraction.fields.size;
  const packageVersion = extraction.fields.packageVersion;
  const gtinStatus = extraction.fields.gtinPublicationStatus;

  return Boolean(
    canonicalIdentifier?.kind === "manufacturer-sku" &&
    evidence.identityKind === "manufacturer-sku" &&
    !Object.prototype.hasOwnProperty.call(evidence, "observedGtin") &&
    catalogueOfficialProductCrosswalkValid(officialProductCrosswalk) &&
    catalogueOfficialProductCrosswalkKeyGrounded(
      officialProductCrosswalk!,
      extraction as CatalogueManufacturerSkuIdentityExtraction & {
        fields: Record<string, unknown>;
      },
    ) &&
    officialProductCrosswalk?.canonicalManufacturerProductKey.basis ===
      "manufacturer-sku" &&
    normalizedManufacturerSku(
      officialProductCrosswalk?.canonicalManufacturerProductKey.value ?? "",
    ) === canonicalIdentifier.value &&
    officialProductCrosswalk?.schemaVersion ===
      catalogueOfficialProductCrosswalkSchemaVersion &&
    officialProductCrosswalk?.officialSourceResponseSha256 ===
      extraction.sourceResponseSha256 &&
    sameUrl(officialProductCrosswalk?.officialProductUrl, evidence.url) &&
    normalized(officialProductCrosswalk?.variant ?? "") ===
      normalized(evidence.observedVariant) &&
    normalizedSize(officialProductCrosswalk?.size ?? "") ===
      normalizedSize(evidence.observedSize) &&
    normalized(officialProductCrosswalk?.packageVersion ?? "") ===
      normalized(evidence.observedPackageVersion ?? "") &&
    evidence.snapshotKind === "canonical-extraction" &&
    evidence.snapshotPath ===
      `data/catalogue-identity-evidence/${candidate.id}.json` &&
    evidence.snapshotMimeType === "application/json" &&
    reviewedOfficialIdentitySource(candidate, evidence.url) &&
    sameUrl(evidence.url, candidate.identity.officialProductUrl) &&
    sameUrl(extraction.sourceUrl, evidence.url) &&
    exactOfficialManufacturerResponseUrl(extraction, evidence.url) &&
    extraction.candidateId === candidate.id &&
    extraction.schemaVersion ===
      catalogueManufacturerSkuIdentityExtractionSchemaVersion &&
    manufacturerIdentityCaptureValid(extraction) &&
    extraction.sourceSnapshotPath ===
      `data/catalogue-identity-source-evidence/${candidate.id}.` +
        (extraction.sourceResponseMimeType === "text/html" ? "html" : "json") &&
    catalogueRetainedRecordShapeValid(extraction.productRecord) &&
    hashPattern.test(extraction.sourceResponseSha256) &&
    Number.isSafeInteger(extraction.sourceResponseByteSize) &&
    extraction.sourceResponseByteSize > 0 &&
    extraction.retrievedAt === evidence.retrievedAt &&
    validPastDate(extraction.retrievedAt, asOf) &&
    validPastDate(extraction.reviewedAt, asOf) &&
    Number.isFinite(checkedAt) &&
    Number.isFinite(retrievedAt) &&
    Number.isFinite(reviewedAt) &&
    reviewedAt >= retrievedAt &&
    reviewedAt <= checkedAt &&
    identityExtractionFieldValid(manufacturerBrand) &&
    normalized(manufacturerBrand.value) === normalized(candidate.brand) &&
    sourceTextNamesCatalogueBrandField(
      manufacturerBrand.sourceText,
      manufacturerBrand.value,
    ) &&
    Array.isArray(manufacturerBrandAliases) &&
    manufacturerBrandAliases.every(
      (alias) =>
        identityExtractionFieldValid(alias) &&
        normalized(alias.value) !== normalized(candidate.brand) &&
        sourceTextNamesCatalogueBrandField(alias.sourceText, alias.value),
    ) &&
    new Set(manufacturerBrandAliases.map((alias) => normalized(alias.value)))
      .size === manufacturerBrandAliases.length &&
    identityExtractionFieldValid(manufacturerSku) &&
    validManufacturerSku(manufacturerSku.value) &&
    validManufacturerSkuLabel(manufacturerSku.label) &&
    manufacturerSku.label === canonicalIdentifier.label &&
    normalizedManufacturerSku(manufacturerSku.value) ===
      canonicalIdentifier.value &&
    sourceNamesManufacturerSkuLabel(
      manufacturerSku.sourceText,
      manufacturerSku.label,
    ) &&
    sourceTextContainsExactIdentifier(
      manufacturerSku.sourceText,
      manufacturerSku.value,
    ) &&
    identityExtractionFieldValid(variant) &&
    normalized(variant.value) === normalized(candidate.variant) &&
    normalized(variant.sourceText).includes(normalized(variant.value)) &&
    identityExtractionFieldValid(size) &&
    normalizedSize(size.value) === normalizedSize(candidate.size) &&
    sourceTextContainsExactSize(size.sourceText, size.value) &&
    identityExtractionFieldValid(packageVersion) &&
    candidate.identity.packageVersion?.trim() &&
    normalized(packageVersion.value) ===
      normalized(candidate.identity.packageVersion) &&
    reviewedManufacturerPackageVersionValid(candidate, packageVersion) &&
    identityExtractionFieldValid(gtinStatus) &&
    gtinStatus.value === "not-published" &&
    (identifierAbsenceProofValid(gtinStatus.absenceProof, extraction) ||
      officialNullIdentifierFieldValid(gtinStatus, manufacturerSku)) &&
    (!gtinStatus.absenceProof ||
      gtinStatus.absenceProof.matchStrategy === "structured-key-variants") &&
    typeof evidence.observedManufacturerSku === "string" &&
    normalizedManufacturerSku(evidence.observedManufacturerSku) ===
      canonicalIdentifier.value &&
    evidence.observedManufacturerSkuLabel === canonicalIdentifier.label &&
    normalized(evidence.observedVariant) === normalized(candidate.variant) &&
    normalizedSize(evidence.observedSize) === normalizedSize(candidate.size) &&
    normalized(evidence.observedPackageVersion ?? "") ===
      normalized(candidate.identity.packageVersion) &&
    hashPattern.test(evidence.snapshotSha256) &&
    Number.isSafeInteger(evidence.snapshotByteSize) &&
    evidence.snapshotByteSize > 0 &&
    evidence.snapshotSha256 === catalogueIdentityExtractionSha256(extraction) &&
    evidence.snapshotByteSize ===
      catalogueIdentityExtractionByteSize(extraction) &&
    typeof extraction.reviewer === "string" &&
    extraction.reviewer.trim().length >= 2,
  );
}

export function officialIdentityEvidenceValid(
  candidate: CatalogueIntakeCandidate,
  asOf: number,
) {
  const evidence = candidate.identity.officialEvidence;
  if (!evidence) return false;
  if (evidence.identityKind === "manufacturer-sku") {
    if (
      Object.prototype.hasOwnProperty.call(evidence, "observedGtin") ||
      typeof evidence.observedManufacturerSku !== "string" ||
      !validManufacturerSkuLabel(evidence.observedManufacturerSkuLabel) ||
      evidence.canonicalExtraction.schemaVersion !==
        catalogueManufacturerSkuIdentityExtractionSchemaVersion
    )
      return false;
    return manufacturerSkuIdentityEvidenceValid(
      candidate,
      evidence as CatalogueOfficialManufacturerSkuIdentityEvidence,
      evidence.canonicalExtraction,
      asOf,
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(evidence, "identityKind") ||
    Object.prototype.hasOwnProperty.call(evidence, "observedManufacturerSku") ||
    Object.prototype.hasOwnProperty.call(
      evidence,
      "observedManufacturerSkuLabel",
    ) ||
    !Object.prototype.hasOwnProperty.call(evidence, "observedGtin") ||
    typeof evidence.observedGtin !== "string"
  )
    return false;
  const gtinEvidence = evidence as CatalogueOfficialGtinIdentityEvidence;
  const extraction = evidence.canonicalExtraction;
  const officialProductCrosswalk = candidate.identity.officialProductCrosswalk;
  if (
    officialProductCrosswalk &&
    (!catalogueOfficialProductCrosswalkValid(officialProductCrosswalk) ||
      !catalogueOfficialProductCrosswalkKeyGrounded(
        officialProductCrosswalk,
        extraction as typeof extraction & { fields: Record<string, unknown> },
      ) ||
      officialProductCrosswalk.officialSourceResponseSha256 !==
        evidence.canonicalExtraction.sourceResponseSha256 ||
      !sameUrl(officialProductCrosswalk.officialProductUrl, evidence.url) ||
      normalized(officialProductCrosswalk.variant) !==
        normalized(evidence.observedVariant) ||
      normalizedSize(officialProductCrosswalk.size) !==
        normalizedSize(evidence.observedSize) ||
      normalized(officialProductCrosswalk.packageVersion) !==
        normalized(evidence.observedPackageVersion ?? ""))
  )
    return false;
  if (
    extraction.schemaVersion ===
    catalogueCorroboratedIdentityExtractionSchemaVersion
  )
    return corroboratedIdentityEvidenceValid(
      candidate,
      gtinEvidence,
      extraction,
      asOf,
    );
  if (
    extraction.schemaVersion ===
    catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion
  )
    return accessibleCorroboratedIdentityEvidenceValid(
      candidate,
      gtinEvidence,
      extraction,
      asOf,
    );

  const checkedAt = Date.parse(candidate.identity.checkedAt ?? "");
  const retrievedAt = Date.parse(evidence?.retrievedAt ?? "");
  const extractionRepresentationValid =
    extraction &&
    ((extraction.schemaVersion === catalogueIdentityExtractionSchemaVersion &&
      extraction.method === "reviewed-exact-identity-field-extraction" &&
      extraction.responseDigestScope === "decoded-response-body" &&
      !("browserCapture" in extraction)) ||
      (extraction.schemaVersion ===
        catalogueBrowserIdentityExtractionSchemaVersion &&
        extraction.method ===
          "reviewed-browser-dom-identity-field-extraction" &&
        extraction.responseDigestScope === "rendered-dom-outerhtml" &&
        extraction.sourceResponseMimeType === "text/html" &&
        reviewedBrowserSurface(extraction.browserCapture.surface) &&
        extraction.browserCapture.documentReadyState === "complete" &&
        extraction.browserCapture.pageTitle.trim().length >= 3));
  return Boolean(
    evidence &&
    typeof evidence.url === "string" &&
    typeof evidence.observedGtin === "string" &&
    typeof evidence.observedVariant === "string" &&
    typeof evidence.observedSize === "string" &&
    typeof evidence.snapshotSha256 === "string" &&
    typeof evidence.snapshotMimeType === "string" &&
    typeof evidence.snapshotByteSize === "number" &&
    typeof evidence.retrievedAt === "string" &&
    reviewedOfficialIdentitySource(candidate, evidence.url) &&
    evidence.snapshotKind === "canonical-extraction" &&
    evidence.snapshotPath ===
      `data/catalogue-identity-evidence/${candidate.id}.json` &&
    evidence.snapshotMimeType === "application/json" &&
    extraction &&
    extractionRepresentationValid &&
    typeof extraction.candidateId === "string" &&
    extraction.candidateId === candidate.id &&
    extraction.fields &&
    identityExtractionFieldValid(extraction.fields.gtin) &&
    identityExtractionFieldValid(extraction.fields.variant) &&
    identityExtractionFieldValid(extraction.fields.size) &&
    extractionNamesExplicitManufacturerIdentifier(extraction.fields.gtin) &&
    typeof extraction.sourceUrl === "string" &&
    typeof extraction.responseUrl === "string" &&
    typeof extraction.retrievedAt === "string" &&
    sameUrl(extraction.sourceUrl, evidence.url) &&
    sameUrl(extraction.responseUrl, extraction.sourceUrl) &&
    extraction.retrievedAt === evidence.retrievedAt &&
    sameGtin(extraction.fields.gtin.value, evidence.observedGtin) &&
    normalized(extraction.fields.variant.value) ===
      normalized(evidence.observedVariant) &&
    normalizedSize(extraction.fields.size.value) ===
      normalizedSize(evidence.observedSize) &&
    sourceTextContainsExactGtin(
      extraction.fields.gtin.sourceText,
      extraction.fields.gtin.value,
    ) &&
    normalized(extraction.fields.variant.sourceText).includes(
      normalized(extraction.fields.variant.value),
    ) &&
    sourceTextContainsExactSize(
      extraction.fields.size.sourceText,
      extraction.fields.size.value,
    ) &&
    typeof extraction.sourceResponseSha256 === "string" &&
    hashPattern.test(extraction.sourceResponseSha256) &&
    rawIdentityEvidenceMimeTypes.includes(extraction.sourceResponseMimeType) &&
    Number.isSafeInteger(extraction.sourceResponseByteSize) &&
    extraction.sourceResponseByteSize > 0 &&
    supplementalIdentityResponsesValid(candidate, extraction, asOf) &&
    typeof extraction.reviewer === "string" &&
    extraction.reviewer.trim().length >= 2 &&
    typeof extraction.reviewedAt === "string" &&
    validPastDate(extraction.reviewedAt, asOf) &&
    Date.parse(extraction.reviewedAt) >= Date.parse(extraction.retrievedAt) &&
    Date.parse(extraction.reviewedAt) <= checkedAt &&
    sameUrl(evidence.url, candidate.identity.officialProductUrl) &&
    sameGtin(
      evidence.observedGtin,
      catalogueGtinForIdentity(candidate.identity),
    ) &&
    normalized(evidence.observedVariant) === normalized(candidate.variant) &&
    normalizedSize(evidence.observedSize) === normalizedSize(candidate.size) &&
    hashPattern.test(evidence.snapshotSha256) &&
    Number.isSafeInteger(evidence.snapshotByteSize) &&
    evidence.snapshotByteSize > 0 &&
    evidence.snapshotSha256 === catalogueIdentityExtractionSha256(extraction) &&
    evidence.snapshotByteSize ===
      catalogueIdentityExtractionByteSize(extraction) &&
    validPastDate(evidence.retrievedAt, asOf) &&
    Number.isFinite(checkedAt) &&
    retrievedAt <= checkedAt,
  );
}
