import { createHash } from "node:crypto";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { products } from "@/data/catalogue";
import { concernBySlug } from "@/data/knowledge";
import { ingredientSeedBySlug } from "@/data/product-ingredients";
import type { Product } from "@/data/products";
import { OG_SIZE } from "@/lib/og/constants";

export const SITE_ORIGIN = "https://www.jelocare.com";

export type SocialCardTheme = "light" | "dark";
export type SocialCardKind =
  | "home"
  | "search"
  | "catalogue"
  | "concerns"
  | "concern"
  | "ingredients"
  | "ingredient"
  | "brands"
  | "retailers"
  | "retailer"
  | "brand"
  | "consult"
  | "contribute"
  | "share-index"
  | "daily-desk"
  | "product"
  | "bundle";

type CatalogueFilterKind =
  "query" | "category" | "brand" | "concern" | "step" | "market";
type ProductSurface = "product" | "share";

export type SocialCardRequest = {
  kind: SocialCardKind;
  slug?: string;
  productSurface?: ProductSurface;
  filterKind?: CatalogueFilterKind;
  filterValue?: string;
};

export type SocialCardModel = {
  request: SocialCardRequest;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  metaTitle: string;
  metaDescription: string;
  alt: string;
  theme: SocialCardTheme;
  packshot?: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

const staticCards = {
  home: {
    request: { kind: "home" },
    eyebrow: "JeloCare",
    title: "Skin, beautifully understood.",
    description: "Products. Prices. Clear context.",
    detail: "For every skin.",
    metaTitle: "Understand your skin",
    metaDescription: "Skin education and clear product discovery.",
    alt: "JeloCare — skin education and clear product discovery",
    theme: "light",
  },
  search: {
    request: { kind: "search" },
    eyebrow: "Search · JeloCare",
    title: "Find products and clear context.",
    description:
      "Search products, reviewed guides, ingredients, companies and retailer sources.",
    detail: "Exact names. Useful sources.",
    metaTitle: "Search",
    metaDescription:
      "Search JeloCare products, reviewed guides, ingredients, companies and retailer sources.",
    alt: "Search JeloCare products, guides, ingredients, companies and retailer sources",
    theme: "dark",
  },
  catalogue: {
    request: { kind: "catalogue" },
    eyebrow: "The catalogue · JeloCare",
    title: "Products, clearly catalogued.",
    description: "Browse exact products with clear context.",
    detail: "Face · Hair & scalp · Body",
    metaTitle: "Products",
    metaDescription:
      "Browse exact skincare, haircare, and body-care products with clear context.",
    alt: "The JeloCare product catalogue",
    theme: "dark",
  },
  concerns: {
    request: { kind: "concerns" },
    eyebrow: "Concern guides · JeloCare",
    title: "Start with what you notice.",
    description: "Calm, educational guides for skin and hair concerns.",
    detail: "Guidance, not a diagnosis.",
    metaTitle: "Concern guides",
    metaDescription:
      "Browse calm, educational guides for skin and hair concerns.",
    alt: "JeloCare skin and hair concern guides",
    theme: "light",
  },
  ingredients: {
    request: { kind: "ingredients" },
    eyebrow: "Ingredient library · JeloCare",
    title: "Know what’s inside.",
    description: "Source-checked ingredients in the JeloCare catalogue.",
    detail: "Key ingredients only. Check your pack.",
    metaTitle: "Ingredients",
    metaDescription: "Source-checked ingredients in the JeloCare catalogue.",
    alt: "The JeloCare source-checked ingredient library",
    theme: "dark",
  },
  brands: {
    request: { kind: "brands" },
    eyebrow: "Brand directory · JeloCare",
    title: "Find the name first.",
    description:
      "Every public JeloCare product, grouped under one canonical brand name.",
    detail: "Exact products · Nigerian price context",
    metaTitle: "Brands",
    metaDescription:
      "Browse every brand represented in the JeloCare public product catalogue.",
    alt: "The JeloCare public brand directory",
    theme: "dark",
  },
  retailers: {
    request: { kind: "retailers" },
    eyebrow: "Retailer guide · JeloCare",
    title: "Stores we check.",
    description:
      "A guide to the Nigerian beauty-store sources JeloCare checks.",
    detail: "A listing is not proof of authenticity.",
    metaTitle: "Retailers",
    metaDescription:
      "The Nigerian beauty-store sources JeloCare checks, plus retailer partnerships.",
    alt: "The JeloCare Nigerian retailer guide",
    theme: "light",
  },
  consult: {
    request: { kind: "consult" },
    eyebrow: "Ask JeloCare",
    title: "What do you notice?",
    description: "Describe your skin in your own words.",
    detail: "Educational guidance, not a diagnosis.",
    metaTitle: "Ask JeloCare",
    metaDescription:
      "Describe what you notice about your skin and receive educational guidance.",
    alt: "Ask JeloCare about what you notice on your skin",
    theme: "dark",
  },
  contribute: {
    request: { kind: "contribute" },
    eyebrow: "Community library · JeloCare",
    title: "Tell us about one product.",
    description: "Share what you use. No account needed.",
    detail: "Anonymous and usually under a minute.",
    metaTitle: "Share skincare",
    metaDescription:
      "Tell JeloCare about one skincare product. Anonymous and usually under a minute.",
    alt: "Contribute a product note to the JeloCare community library",
    theme: "light",
  },
  "share-index": {
    request: { kind: "share-index" },
    eyebrow: "Worth sharing · JeloCare",
    title: "Pass on clear context.",
    description: "Exact products and source-checked guides worth sharing.",
    detail: "Product identity first.",
    metaTitle: "Worth sharing",
    metaDescription:
      "Exact products and source-checked guides worth passing on.",
    alt: "Products and source-checked guides worth sharing from JeloCare",
    theme: "dark",
  },
  "daily-desk": {
    request: { kind: "daily-desk" },
    eyebrow: "Lagos Daily Desk · JeloCare",
    title: "One useful price note.",
    description:
      "One accepted, evidence-checked Nigerian beauty price story each Lagos day.",
    detail: "Exact product. Current source context.",
    metaTitle: "Lagos Daily Desk",
    metaDescription:
      "One accepted, evidence-checked Nigerian beauty price story from JeloCare, updated daily.",
    alt: "The JeloCare Lagos Daily Desk",
    theme: "light",
  },
  bundle: {
    request: { kind: "bundle" },
    eyebrow: "Bundle Finder · JeloCare",
    title: "One basket. One retailer.",
    description:
      "Choose 2–4 products and compare stores with exact listings for every item.",
    detail: "Exact listings. Verified quote before payment.",
    metaTitle: "Bundle Finder",
    metaDescription:
      "Choose 2–4 products and compare one-retailer baskets before requesting a verified quote.",
    alt: "JeloCare Bundle Finder — one exact basket from one retailer",
    theme: "light",
  },
} satisfies Partial<Record<SocialCardKind, SocialCardModel>>;

export const PUBLIC_SOCIAL_ROUTE_COVERAGE = [
  { family: "/", source: "app/(site)/page.tsx", context: "home" },
  {
    family: "/search",
    source: "app/(site)/search/page.tsx",
    context: "global public search",
  },
  {
    family: "/products",
    source: "app/(site)/products/page.tsx",
    context: "catalogue and validated filter state",
  },
  {
    family: "/products/[slug]",
    source: "app/(site)/products/[slug]/page.tsx",
    context: "exact catalogue SKU and packshot",
  },
  {
    family: "/concerns",
    source: "app/(site)/concerns/page.tsx",
    context: "concern guide index",
  },
  {
    family: "/concerns/[slug]",
    source: "app/(site)/concerns/[slug]/page.tsx",
    context: "exact concern guide",
  },
  {
    family: "/ingredients",
    source: "app/(site)/ingredients/page.tsx",
    context: "ingredient library index",
  },
  {
    family: "/brands",
    source: "app/(site)/brands/page.tsx",
    context: "public brand directory",
  },
  {
    family: "/retailers",
    source: "app/(site)/retailers/page.tsx",
    context: "retailer guide",
  },
  {
    family: "/retailers/[slug]",
    source: "app/(site)/retailers/[slug]/page.tsx",
    context: "exact retailer profile and observed products",
  },
  {
    family: "/bundle",
    source: "app/(site)/bundle/page.tsx",
    context: "bundle finder for multi-product shipment savings",
  },
  {
    family: "/brands/[slug]",
    source: "app/(site)/brands/[slug]/page.tsx",
    context: "exact brand profile and public catalogue products",
  },
  {
    family: "/consult",
    source: "app/(site)/consult/page.tsx",
    context: "educational consultation entry",
  },
  {
    family: "/contribute",
    source: "app/(site)/contribute/page.tsx",
    context: "anonymous contribution entry",
  },
  {
    family: "/share",
    source: "app/(site)/share/page.tsx",
    context: "share landing",
  },
  {
    family: "/lagos",
    source: "app/(site)/lagos/page.tsx",
    context: "current accepted Nigerian campaign story",
  },
  {
    family: "/share/[slug]",
    source: "app/(site)/share/[slug]/page.tsx",
    context: "exact shareable SKU and packshot",
  },
  {
    family: "/share/ingredient/[slug]",
    source: "app/(site)/share/ingredient/[slug]/page.tsx",
    context: "exact source-checked ingredient",
  },
] as const;

export const NON_INDEXABLE_ROUTE_COVERAGE = [
  { family: "/basket", reason: "device-local guest basket" },
  { family: "/checkout", reason: "private guest checkout" },
  { family: "/order", reason: "private order status" },
  { family: "/image-audit", reason: "internal catalogue media review" },
  {
    family: "/go",
    reason: "transitional retailer handoff — not a destination page",
  },
  { family: "/sign-in", reason: "authentication" },
  { family: "/me", reason: "private customer workspace" },
  { family: "/ops", reason: "private operations workspace" },
] as const;

export function staticSocialCard(
  kind: keyof typeof staticCards,
): SocialCardModel {
  return staticCards[kind];
}

function first(params: SearchParams, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function truncate(value: string, maximum = 170) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trimEnd()}…`;
}

function canonicalCatalogueQuery(params: SearchParams) {
  const query = new URLSearchParams();
  const category = ["Face", "Hair", "Body"].find(
    (value) => value === first(params, "category"),
  );
  const concern = concernBySlug(first(params, "concern"));
  const brand = products
    .map((product) => product.brand)
    .find(
      (value) =>
        value.toLocaleLowerCase() ===
        first(params, "brand").toLocaleLowerCase(),
    );
  const step = products
    .map((product) => product.step)
    .find(
      (value) =>
        value.toLocaleLowerCase() === first(params, "step").toLocaleLowerCase(),
    );
  const market = first(params, "market") === "US" ? "US" : "";
  const q = first(params, "q").slice(0, 80);

  if (q) query.set("q", q);
  if (category) query.set("category", category);
  if (brand) query.set("brand", brand);
  if (concern) query.set("concern", concern.slug);
  if (step) query.set("step", step);
  if (market) query.set("market", market);

  for (const [key, allowed] of [
    ["review", ["reviewed", "supportive", "community"]],
    ["availability", ["priced"]],
    ["price", ["low", "mid", "high"]],
  ] as const) {
    const value = first(params, key);
    if (allowed.includes(value as never)) query.set(key, value);
  }

  return { query, q, category, concern, brand, step, market };
}

export function catalogueSocialCard(params: SearchParams): {
  card: SocialCardModel;
  canonicalPath: string;
} {
  const resolved = canonicalCatalogueQuery(params);
  const request: SocialCardRequest = { kind: "catalogue" };
  let title = staticCards.catalogue.title;
  let description = staticCards.catalogue.description;
  let metaTitle = staticCards.catalogue.metaTitle;
  let alt = staticCards.catalogue.alt;

  if (resolved.q) {
    request.filterKind = "query";
    request.filterValue = "search";
    title = "Catalogue search.";
    description = "Explore the current JeloCare catalogue search.";
    metaTitle = "Catalogue search";
    alt = "A filtered JeloCare catalogue search";
  } else if (resolved.concern) {
    request.filterKind = "concern";
    request.filterValue = resolved.concern.slug;
    title = `${resolved.concern.name} catalogue view.`;
    description = "Browse product profiles alongside the concern guide.";
    metaTitle = `${resolved.concern.name} catalogue`;
    alt = `The ${resolved.concern.name} catalogue view on JeloCare`;
  } else if (resolved.category) {
    request.filterKind = "category";
    request.filterValue = resolved.category;
    const label =
      resolved.category === "Hair"
        ? "Hair & scalp"
        : `${resolved.category} care`;
    title = `${label}, clearly catalogued.`;
    description = "Browse exact products with clear context.";
    metaTitle = `${label} products`;
    alt = `The ${label.toLocaleLowerCase()} catalogue on JeloCare`;
  } else if (resolved.brand) {
    request.filterKind = "brand";
    request.filterValue = resolved.brand;
    title = `${resolved.brand} products.`;
    description = "Browse exact product profiles in the JeloCare catalogue.";
    metaTitle = `${resolved.brand} products`;
    alt = `${resolved.brand} products in the JeloCare catalogue`;
  } else if (resolved.step) {
    request.filterKind = "step";
    request.filterValue = resolved.step;
    title = `${resolved.step} products.`;
    description = "Browse exact product profiles by routine step.";
    metaTitle = `${resolved.step} products`;
    alt = `${resolved.step} products in the JeloCare catalogue`;
  } else if (resolved.market) {
    request.filterKind = "market";
    request.filterValue = resolved.market;
    title = "United States catalogue view.";
    description = "Browse exact products with clear context.";
    metaTitle = "United States catalogue";
    alt = "The United States catalogue view on JeloCare";
  }

  const suffix = resolved.query.toString();
  return {
    canonicalPath: suffix ? `/products?${suffix}` : "/products",
    card: {
      ...staticCards.catalogue,
      request,
      title,
      description,
      metaTitle,
      metaDescription: description,
      alt,
    },
  };
}

export function productSocialCard(
  product: Pick<
    Product,
    "slug" | "brand" | "name" | "size" | "category" | "image"
  >,
  surface: ProductSurface,
): SocialCardModel {
  const exactName = `${product.brand} ${product.name}`;
  return {
    request: { kind: "product", slug: product.slug, productSurface: surface },
    eyebrow:
      surface === "share"
        ? `Worth sharing · ${product.brand}`
        : `${product.brand} · JeloCare`,
    title: product.name,
    description: `${product.size} · ${product.category}`,
    detail:
      surface === "share"
        ? "Exact product. Clear context."
        : "Product profile at jelocare.com",
    metaTitle: exactName,
    metaDescription: `${exactName}, ${product.size}. Product details from JeloCare.`,
    alt: `${exactName}, ${product.size} — JeloCare product card`,
    theme: surface === "share" ? "light" : "dark",
    packshot: hasPublishableProductImage(product.image) ? product.image : null,
  };
}

export function concernSocialCard(slug: string): SocialCardModel | null {
  const concern = concernBySlug(slug);
  if (!concern) return null;
  return {
    request: { kind: "concern", slug: concern.slug },
    eyebrow: `${concern.area} · JeloCare guide`,
    title: concern.name,
    description: truncate(concern.summary),
    detail: "Guidance, not a diagnosis.",
    metaTitle: concern.name,
    metaDescription: concern.summary,
    alt: `${concern.name} — an educational JeloCare guide`,
    theme: "light",
  };
}

export function ingredientSocialCard(slug: string): SocialCardModel | null {
  const ingredient = ingredientSeedBySlug(slug);
  if (!ingredient) return null;
  return {
    request: { kind: "ingredient", slug: ingredient.slug },
    eyebrow: "Source-checked ingredient · JeloCare",
    title: ingredient.commonName,
    description: truncate(ingredient.summary),
    detail: `${ingredient.inciName} · Check your pack.`,
    metaTitle: ingredient.commonName,
    metaDescription: ingredient.summary,
    alt: `${ingredient.commonName} — a source-checked JeloCare ingredient card`,
    theme: "dark",
  };
}

export function hasPublishableProductImage(image: string | null | undefined) {
  return Boolean(
    image && !/\/(?:product-)?(?:placeholder|fallback)(?:[./-]|$)/i.test(image),
  );
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE_ORIGIN).toString();
}

export function socialCardVersion(card: SocialCardModel) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        request: card.request,
        eyebrow: card.eyebrow,
        title: card.title,
        description: card.description,
        detail: card.detail,
        alt: card.alt,
        theme: card.theme,
        packshot: card.packshot,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

export function socialImageUrl(card: SocialCardModel) {
  const url = new URL("/og", SITE_ORIGIN);
  url.searchParams.set("kind", card.request.kind);
  if (card.request.slug) url.searchParams.set("slug", card.request.slug);
  if (card.request.productSurface)
    url.searchParams.set("surface", card.request.productSurface);
  if (card.request.filterKind)
    url.searchParams.set("filter", card.request.filterKind);
  if (card.request.filterValue)
    url.searchParams.set("value", card.request.filterValue);
  url.searchParams.set("v", socialCardVersion(card));
  return url.toString();
}

export function publicSocialMetadata(
  card: SocialCardModel,
  canonicalPath: string,
): Metadata {
  const canonical = absoluteUrl(canonicalPath);
  const image = socialImageUrl(card);
  const imageDescriptor = {
    url: image,
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    type: "image/png",
    alt: card.alt,
  };

  return {
    title: card.metaTitle,
    description: card.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: card.metaTitle,
      description: card.metaDescription,
      url: canonical,
      siteName: "JeloCare",
      type: "website",
      images: [imageDescriptor],
    },
    twitter: {
      card: "summary_large_image",
      title: card.metaTitle,
      description: card.metaDescription,
      images: [imageDescriptor],
    },
  };
}

function catalogueRequestParams(request: SocialCardRequest): SearchParams {
  if (!request.filterKind || !request.filterValue) return {};
  if (request.filterKind === "query") return { q: "search" };
  return { [request.filterKind]: request.filterValue };
}

type ProductCardIdentity = Pick<
  Product,
  "slug" | "brand" | "name" | "size" | "category" | "image"
>;
export type RetailerCardIdentity = {
  slug: string;
  name: string;
  productCount: number;
};

export type BrandCardIdentity = {
  slug: string;
  name: string;
  productCount: number;
  categoryCount: number;
};

export function retailerSocialCard(
  retailer: RetailerCardIdentity,
): SocialCardModel {
  const productLabel = `${retailer.productCount} ${retailer.productCount === 1 ? "product" : "products"}`;
  const hasProducts = retailer.productCount > 0;
  return {
    request: { kind: "retailer", slug: retailer.slug },
    eyebrow: "Retailer profile · JeloCare",
    title: retailer.name,
    description: hasProducts
      ? `${productLabel} with current exact Nigerian prices.`
      : "No current exact-product prices yet.",
    detail: "Prices may change · Listing ≠ genuine",
    metaTitle: `${retailer.name} products and prices`,
    metaDescription: hasProducts
      ? `Current exact-product prices JeloCare has observed at ${retailer.name} in Nigeria.`
      : `JeloCare retailer profile for ${retailer.name}. No fresh exact-product offer is public yet.`,
    alt: `${retailer.name} retailer profile on JeloCare · ${productLabel} observed`,
    theme: "light",
  };
}

export function brandSocialCard(brand: BrandCardIdentity): SocialCardModel {
  const productLabel = `${brand.productCount} ${brand.productCount === 1 ? "product" : "products"}`;
  const areaLabel = `${brand.categoryCount} ${brand.categoryCount === 1 ? "care area" : "care areas"}`;
  return {
    request: { kind: "brand", slug: brand.slug },
    eyebrow: "Brand profile · JeloCare",
    title: brand.name,
    description: `${productLabel} across ${areaLabel}.`,
    detail: "Exact products · Nigerian price context",
    metaTitle: `${brand.name} products`,
    metaDescription: `Browse ${productLabel} from ${brand.name} in the JeloCare catalogue, with current Nigerian price context where available.`,
    alt: `${brand.name} brand profile on JeloCare · ${productLabel}`,
    theme: "dark",
  };
}

export async function resolveSocialCard(
  url: URL,
  findProduct: (
    slug: string,
  ) => Promise<ProductCardIdentity | undefined> = async (slug) =>
    products.find((product) => product.slug === slug),
  findRetailer: (
    slug: string,
  ) => Promise<RetailerCardIdentity | undefined> = async () => undefined,
  findBrand: (
    slug: string,
  ) => Promise<BrandCardIdentity | undefined> = async () => undefined,
): Promise<SocialCardModel | null> {
  const kind = url.searchParams.get("kind") as SocialCardKind | null;
  if (!kind) return null;

  if (kind in staticCards && kind !== "catalogue") {
    return staticCards[kind as keyof typeof staticCards];
  }
  if (kind === "catalogue") {
    const filterKind = url.searchParams.get(
      "filter",
    ) as CatalogueFilterKind | null;
    const filterValue = url.searchParams.get("value") ?? "";
    return catalogueSocialCard(
      catalogueRequestParams({
        kind,
        filterKind: filterKind ?? undefined,
        filterValue,
      }),
    ).card;
  }
  if (kind === "product") {
    const slug = url.searchParams.get("slug") ?? "";
    const product = await findProduct(slug);
    if (!product) return null;
    return productSocialCard(
      product,
      url.searchParams.get("surface") === "share" ? "share" : "product",
    );
  }
  if (kind === "retailer") {
    const retailer = await findRetailer(url.searchParams.get("slug") ?? "");
    return retailer ? retailerSocialCard(retailer) : null;
  }
  if (kind === "brand") {
    const brand = await findBrand(url.searchParams.get("slug") ?? "");
    return brand ? brandSocialCard(brand) : null;
  }
  if (kind === "concern")
    return concernSocialCard(url.searchParams.get("slug") ?? "");
  if (kind === "ingredient")
    return ingredientSocialCard(url.searchParams.get("slug") ?? "");
  return null;
}

const palettes = {
  light: {
    canvas: "#fbf3ed",
    surface: "#fffdf9",
    stage: "#f4d4c5",
    ink: "#2d211f",
    muted: "#7a6b66",
    accent: "#6b3b35",
    hairline: "rgba(107,59,53,.18)",
  },
  dark: {
    canvas: "#000000",
    surface: "#121212",
    stage: "#202020",
    ink: "#f7f7f4",
    muted: "#b7b7b2",
    accent: "#ffffff",
    hairline: "rgba(255,255,255,.16)",
  },
} as const;

function titleSize(title: string, product: boolean) {
  if (product) {
    if (title.length > 70) return 38;
    if (title.length > 52) return 44;
    if (title.length > 34) return 51;
    return 58;
  }
  if (title.length > 54) return 56;
  if (title.length > 36) return 64;
  return 76;
}

export function SocialCard({
  card,
  packshotSrc,
}: {
  card: SocialCardModel;
  packshotSrc?: string | null;
}): ReactElement {
  const palette = palettes[card.theme];
  const isProduct = card.request.kind === "product";
  const hasPackshot = isProduct && Boolean(packshotSrc);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 48,
        background: palette.canvas,
        color: palette.ink,
        fontFamily: "Manrope",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 38,
          background: palette.surface,
          boxShadow:
            card.theme === "light"
              ? "0 28px 80px rgba(112,71,61,.14)"
              : "0 28px 80px rgba(0,0,0,.52)",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            right: -110,
            top: -150,
            display: "flex",
            borderRadius: 999,
            background: palette.stage,
            opacity: card.theme === "light" ? 0.58 : 0.7,
          }}
        />

        {isProduct ? (
          <div
            style={{
              position: "relative",
              width: 430,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 34,
              background: palette.stage,
            }}
          >
            {hasPackshot ? (
              // The packshot is already normalised and inlined as a PNG data URL for next/og.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={packshotSrc as string}
                width={340}
                height={440}
                style={{ objectFit: "contain" }}
                alt=""
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: 32,
                  color: palette.muted,
                }}
              >
                <span
                  style={{
                    fontFamily: "Italiana",
                    fontSize: 108,
                    lineHeight: 1,
                    color: palette.ink,
                  }}
                >
                  J
                </span>
                <span
                  style={{
                    display: "flex",
                    fontSize: 18,
                    lineHeight: 1.4,
                    marginTop: 20,
                  }}
                >
                  Exact packshot unavailable
                </span>
              </div>
            )}
          </div>
        ) : null}

        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: isProduct ? "54px 64px 48px 54px" : "68px 78px 58px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: palette.accent,
            }}
          >
            {card.eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: isProduct ? 610 : 920,
              fontFamily: "Italiana",
              fontSize: titleSize(card.title, isProduct),
              lineHeight: 1.05,
              color: palette.ink,
              marginTop: 18,
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: isProduct ? 590 : 850,
              fontSize: isProduct ? 25 : 29,
              lineHeight: 1.38,
              color: palette.muted,
              marginTop: 22,
            }}
          >
            {card.description}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 17,
              color: palette.muted,
              marginTop: "auto",
            }}
          >
            <span
              style={{
                display: "flex",
                width: 52,
                height: 1,
                background: palette.hairline,
                marginRight: 16,
              }}
            />
            {card.detail}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 16,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: palette.muted,
              marginTop: 22,
            }}
          >
            <span>jelocare.com</span>
            <span>JeloCare</span>
          </div>
        </div>
      </div>
    </div>
  );
}
