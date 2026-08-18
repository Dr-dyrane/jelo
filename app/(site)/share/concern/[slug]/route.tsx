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
  return concerns
    .filter((c) => c.kind === "concern")
    .map((c) => ({ slug: c.slug }));
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
        padding: "10px 22px",
        borderRadius: 999,
        background,
        color,
        fontFamily: "Manrope",
        fontSize: 22,
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
  priceNgn: number | null;
};

function ProductRow({ product }: { product: StoryProduct }) {
  const naira = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.image}
        alt=""
        width={72}
        height={72}
        style={{
          width: 72,
          height: 72,
          objectFit: "contain",
          borderRadius: 12,
          background: "rgba(255,255,255,.06)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 20,
            fontWeight: 600,
            color: "#fffaf4",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {product.brand}
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            color: "rgba(255,250,244,.72)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {product.name} · {product.size}
        </span>
      </div>
      {product.priceNgn ? (
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 22,
            fontWeight: 600,
            color: "#ff7417",
            whiteSpace: "nowrap",
          }}
        >
          {naira.format(product.priceNgn)}
        </span>
      ) : null}
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
  const topSignals = concern.signals.slice(0, 4);
  const topIngredients = concern.ingredients.slice(0, 4);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 38%, #1a1218 0%, #0d0a0e 40%, #050405 72%, #000 100%)",
        color: "#fffaf4",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 200,
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

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 330,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 72,
            fontWeight: 400,
            color: "#fffaf4",
            lineHeight: 1.1,
          }}
        >
          {concern.name}
        </span>
        <span
          style={{
            marginTop: 16,
            fontFamily: "Manrope",
            fontSize: 26,
            color: "rgba(255,250,244,.76)",
            lineHeight: 1.4,
          }}
        >
          {concern.summary}
        </span>
        <span
          style={{
            marginTop: 10,
            fontFamily: "Manrope",
            fontSize: 20,
            color: "#ff7417",
            fontWeight: 600,
          }}
        >
          Guidance, not a diagnosis.
        </span>
      </div>

      {/* What it looks like */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 620,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "rgba(255,250,244,.52)",
          }}
        >
          What it looks like
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {topSignals.map((signal) => (
            <Chip key={signal}>{signal}</Chip>
          ))}
        </div>
      </div>

      {/* What may help */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 830,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "rgba(255,250,244,.52)",
          }}
        >
          What may help
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {topIngredients.map((ingredient) => (
            <Chip
              key={ingredient}
              color="#ff9a4a"
              background="rgba(255,117,35,.12)"
            >
              {ingredient.length > 42
                ? `${ingredient.slice(0, 40)}…`
                : ingredient}
            </Chip>
          ))}
        </div>
      </div>

      {/* Products */}
      {products.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 120,
            right: 120,
            top: 1040,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "rgba(255,250,244,.52)",
            }}
          >
            Find on JeloCare
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {products.map((product) => (
              <ProductRow
                key={product.brand + product.name}
                product={product}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,250,244,.56)",
          fontFamily: "Manrope",
          fontSize: 21,
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
  if (!concern || concern.kind !== "concern") {
    return new Response("Concern not found.", { status: 404 });
  }

  const fonts = await loadOgFonts();

  // Resolve matched products with their images and lowest prices
  const allProducts = await listCatalogueProducts();
  const linked = productsLinkedToConcern(allProducts, concern);
  const candidateProducts = [...linked.supportive, ...linked.reviewedContext];

  const storyProducts: StoryProduct[] = [];
  for (const product of candidateProducts.slice(0, 3)) {
    const imageSrc = await loadImage(absoluteImage(product.image));
    const lowestOffer = product.offers
      .filter(
        (o): o is typeof o & { priceNgn: number } =>
          o.available && typeof o.priceNgn === "number" && o.priceNgn > 0,
      )
      .sort((a, b) => a.priceNgn - b.priceNgn)[0];
    storyProducts.push({
      brand: product.brand,
      name: product.name,
      size: product.size,
      image: imageSrc ?? "",
      priceNgn: lowestOffer ? lowestOffer.priceNgn : null,
    });
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
