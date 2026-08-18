import { ImageResponse } from "next/og";
import { concerns, concernBySlug } from "@/data/knowledge";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { productsLinkedToConcern } from "@/modules/concerns/product-matching";
import { absoluteImage, loadOgFonts, loadImage } from "@/lib/og/assets";
import { CAMPAIGN_STORY_SIZE } from "@/lib/share/campaign-story";

export const runtime = "nodejs";

const fullDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

export function generateStaticParams() {
  return concerns.map((c) => ({ slug: c.slug }));
}

function JeloCareMark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        color: "#fffaf4",
        fontFamily: "Manrope",
        fontSize: 40,
        letterSpacing: "-1.6px",
      }}
    >
      <span style={{ fontWeight: 600 }}>Jelo</span>
      <span style={{ fontWeight: 400, opacity: 0.9 }}>Care</span>
    </div>
  );
}

function Chip({
  children,
  color = "rgba(255,250,244,.84)",
  background = "rgba(255,255,255,.08)",
}: {
  children: string;
  color?: string;
  background?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 18px",
        borderRadius: 999,
        background,
        color,
        fontFamily: "Manrope",
        fontSize: 20,
        fontWeight: 400,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

type StoryProduct = {
  brand: string;
  name: string;
  size: string;
  image: string;
};

/**
 * Campaign-style product carousel — one product centered with radial
 * gradient glow, two flanking products smaller and dimmer. This is the
 * visual hero of the card, matching the campaign price/trend cards.
 */
function ProductCarousel({ products }: { products: StoryProduct[] }) {
  if (products.length === 0) return null;

  // Center product is always index 0 (highest priority match).
  const center = products[0]!;
  const left = products[1];
  const right = products[2];

  const centerSize = 520;
  const sideSize = 320;
  const centerTop = 980;
  const sideTop = 1060;

  // Center product position
  const centerLeft = (1080 - centerSize) / 2;

  // Side product positions
  const leftLeft = 40;
  const rightLeft = 1080 - sideSize - 40;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
      }}
    >
      {/* Glow behind center product */}
      <div
        style={{
          position: "absolute",
          left: (1080 - 760) / 2,
          top: centerTop - 60,
          width: 760,
          height: 700,
          borderRadius: 999,
          background:
            "radial-gradient(ellipse at center, rgba(255,117,35,.30) 0%, rgba(153,59,25,.14) 38%, rgba(44,16,9,.06) 58%, rgba(0,0,0,0) 74%)",
        }}
      />
      {/* Ground shadow */}
      <div
        style={{
          position: "absolute",
          left: (1080 - 520) / 2,
          top: centerTop + centerSize - 30,
          width: 520,
          height: 120,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,.72) 0%, rgba(0,0,0,.42) 48%, rgba(0,0,0,0) 76%)",
        }}
      />

      {/* Left product (smaller, dimmer) */}
      {left ? (
        <div
          style={{
            position: "absolute",
            left: leftLeft,
            top: sideTop,
            width: sideSize,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: 0.5,
          }}
        >
          {left.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={left.image}
              alt=""
              width={sideSize}
              height={sideSize}
              style={{
                width: sideSize,
                height: sideSize,
                objectFit: "contain",
              }}
            />
          ) : null}
        </div>
      ) : null}

      {/* Right product (smaller, dimmer) */}
      {right ? (
        <div
          style={{
            position: "absolute",
            left: rightLeft,
            top: sideTop,
            width: sideSize,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: 0.5,
          }}
        >
          {right.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={right.image}
              alt=""
              width={sideSize}
              height={sideSize}
              style={{
                width: sideSize,
                height: sideSize,
                objectFit: "contain",
              }}
            />
          ) : null}
        </div>
      ) : null}

      {/* Center product (hero) */}
      <div
        style={{
          position: "absolute",
          left: centerLeft,
          top: centerTop,
          width: centerSize,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {center.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={center.image}
            alt=""
            width={centerSize}
            height={centerSize}
            style={{
              width: centerSize,
              height: centerSize,
              objectFit: "contain",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ConcernStory({
  concern,
  products,
  reviewedAtLabel,
}: {
  concern: NonNullable<ReturnType<typeof concernBySlug>>;
  products: StoryProduct[];
  reviewedAtLabel: string;
}) {
  const topSignals = concern.signals.slice(0, 3);
  const topIngredients = concern.ingredients.slice(0, 3);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 42%, #1a1218 0%, #0d0a0e 40%, #050405 72%, #000 100%)",
        color: "#fffaf4",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <JeloCareMark />
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "2.8px",
            textTransform: "uppercase",
            color: "rgba(255,250,244,.64)",
          }}
        >
          {concern.area} guide
        </span>
      </div>

      {/* Headline — compact, ad-style */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 290,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 80,
            fontWeight: 400,
            color: "#fffaf4",
            lineHeight: 1.05,
          }}
        >
          {concern.name}
        </span>
        <span
          style={{
            marginTop: 14,
            fontFamily: "Manrope",
            fontSize: 24,
            color: "rgba(255,250,244,.72)",
            lineHeight: 1.35,
          }}
        >
          {concern.summary}
        </span>
      </div>

      {/* Signal chips — compact row */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 540,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
        }}
      >
        {topSignals.map((signal) => (
          <Chip key={signal}>{signal}</Chip>
        ))}
      </div>

      {/* Ingredient chips — compact row, orange */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 640,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
        }}
      >
        {topIngredients.map((ingredient) => (
          <Chip
            key={ingredient}
            color="#ff9a4a"
            background="rgba(255,117,35,.12)"
          >
            {ingredient.length > 36
              ? `${ingredient.slice(0, 34)}…`
              : ingredient}
          </Chip>
        ))}
      </div>

      {/* Product carousel — the visual hero */}
      <ProductCarousel products={products} />

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,250,244,.52)",
          fontFamily: "Manrope",
          fontSize: 20,
        }}
      >
        <span>jelocare.com/concerns/{concern.slug}</span>
        <span>Reviewed {reviewedAtLabel}</span>
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  if (!concern) {
    return new Response("Concern not found.", { status: 404 });
  }

  const fonts = await loadOgFonts();

  // Resolve matched products with their images and lowest prices.
  // Condition patterns have no product matches — the card renders without
  // the product carousel, which is the correct behaviour for clinical
  // patterns where product recommendations would be inappropriate.
  const storyProducts: StoryProduct[] = [];
  if (concern.kind === "concern") {
    const allProducts = await listCatalogueProducts();
    const linked = productsLinkedToConcern(allProducts, concern);
    const candidateProducts = [...linked.supportive, ...linked.reviewedContext];

    for (const product of candidateProducts.slice(0, 3)) {
      const imageSrc = await loadImage(absoluteImage(product.image));
      storyProducts.push({
        brand: product.brand,
        name: product.name,
        size: product.size,
        image: imageSrc ?? "",
      });
    }
  }

  const reviewedAtLabel = fullDate.format(new Date(concern.reviewedAt));
  const fileName = `${slug}-concern-story.png`.replace(/[^a-z0-9._-]+/gi, "-");

  return new ImageResponse(
    <ConcernStory
      concern={concern}
      products={storyProducts}
      reviewedAtLabel={reviewedAtLabel}
    />,
    {
      ...CAMPAIGN_STORY_SIZE,
      fonts,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
