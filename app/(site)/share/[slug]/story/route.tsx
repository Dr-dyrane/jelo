import { ImageResponse } from "next/og";
import { buildShareData, type ShareData } from "../share-data";
import {
  buildCampaignTrendStory,
  buildMonotoneCampaignPath,
  CAMPAIGN_STORY_SIZE,
  formatCampaignProductSize,
  type CampaignTrendHistory,
} from "@/lib/share/campaign-story";
import { absoluteImage, loadImage, loadOgFonts } from "@/lib/og/assets";
import {
  getProductTrendData,
  type ProductTrendData,
  type TrendPricePoint,
} from "@/lib/share/product-trends";
import {
  DEFAULT_TREND_WINDOW,
  isTrendWindowKey,
  trendWindowDefinition,
  type TrendWindowKey,
} from "@/lib/share/trend-window";

export const runtime = "nodejs";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const fullDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});

type StoryKind = "price" | "trend";

function observedLabel(value: string | null) {
  if (!value) return "Observed recently";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Observed recently"
    : `Observed ${fullDate.format(date)}`;
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

function StoryFooter({ observedAt }: { observedAt: string | null }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        right: 120,
        bottom: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: "rgba(255,250,244,.72)",
        fontFamily: "Manrope",
        fontSize: 23,
      }}
    >
      <span>Prices change.</span>
      <span>{observedLabel(observedAt)}</span>
    </div>
  );
}

function CampaignAmount({
  value,
  color = "#fffaf4",
  fontSize,
  fontWeight = 600,
  letterSpacing = "-1px",
}: {
  value: string;
  color?: string;
  fontSize: number;
  fontWeight?: 400 | 600;
  letterSpacing?: string;
}) {
  const hasNaira = value.trim().startsWith("₦");
  const amount = hasNaira ? value.trim().replace(/^₦\s*/, "") : value;
  const strokeHeight = Math.max(2, Math.round(fontSize * 0.045));

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        color,
        fontFamily: "Manrope",
        fontSize,
        fontWeight,
        letterSpacing,
        lineHeight: 1,
      }}
    >
      {hasNaira ? (
        <span
          style={{
            position: "relative",
            width: Math.round(fontSize * 0.74),
            height: fontSize,
            display: "flex",
            alignItems: "center",
            marginRight: Math.round(fontSize * 0.035),
          }}
        >
          <span style={{ fontSize, fontWeight, lineHeight: 1 }}>N</span>
          <span
            style={{
              position: "absolute",
              left: -1,
              top: Math.round(fontSize * 0.36),
              width: Math.round(fontSize * 0.77),
              height: strokeHeight,
              background: color,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: -1,
              top: Math.round(fontSize * 0.52),
              width: Math.round(fontSize * 0.77),
              height: strokeHeight,
              background: color,
            }}
          />
        </span>
      ) : null}
      <span>{amount}</span>
    </span>
  );
}

function ProductStage({
  packshotSrc,
  compact = false,
}: {
  packshotSrc: string;
  compact?: boolean;
}) {
  const top = compact ? 1151 : 774;
  const imageSize = compact ? 440 : 800;
  const left = compact ? 595 : 140;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: compact ? 585 : 110,
          top: compact ? 1126 : 759,
          width: compact ? 465 : 860,
          height: compact ? 470 : 790,
          borderRadius: 999,
          background:
            "radial-gradient(ellipse at center, rgba(255,117,35,.34) 0%, rgba(153,59,25,.16) 38%, rgba(44,16,9,.07) 58%, rgba(0,0,0,0) 74%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: compact ? 630 : 205,
          top: compact ? 1481 : 1409,
          width: compact ? 330 : 670,
          height: compact ? 105 : 190,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,139,59,.2) 0%, rgba(124,45,17,.11) 44%, rgba(0,0,0,0) 74%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: compact ? 665 : 315,
          top: compact ? 1510 : 1486,
          width: compact ? 260 : 450,
          height: compact ? 40 : 58,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,.88) 0%, rgba(0,0,0,.55) 48%, rgba(0,0,0,0) 76%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={packshotSrc}
        alt=""
        width={imageSize}
        height={imageSize}
        style={{
          position: "absolute",
          left,
          top,
          width: imageSize,
          height: imageSize,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

function PriceStory({
  data,
  packshotSrc,
}: {
  data: ShareData;
  packshotSrc: string;
}) {
  const { view } = data;
  const lowest = view.offers[0]?.priceLabel ?? "—";
  const highest = view.offers.at(-1)?.priceLabel ?? lowest;
  const hasGap = Boolean(view.spreadLabel && view.offers.length >= 2);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 66%, #231009 0%, #090706 31%, #020202 64%, #000 100%)",
        color: "#fffaf4",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 240,
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
          Observed in Nigeria
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 390,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 54,
            fontWeight: 400,
            letterSpacing: "-2px",
          }}
        >
          {hasGap ? "Same product." : "Current price."}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 10,
            fontFamily: "Manrope",
            fontSize: 64,
            letterSpacing: "-3px",
          }}
        >
          <CampaignAmount
            value={hasGap ? view.spreadLabel! : lowest}
            color="#ff7417"
            fontSize={64}
            letterSpacing="-3px"
          />
          {hasGap ? (
            <span style={{ marginLeft: 18, fontWeight: 400 }}>apart.</span>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 52,
            fontFamily: "Manrope",
            fontSize: 22,
            letterSpacing: ".2px",
            color: "rgba(255,250,244,.84)",
            textTransform: "uppercase",
          }}
        >
          <span>{view.brand}</span>
          <span style={{ margin: "0 10px", color: "#ff7417" }}>·</span>
          <span style={{ textTransform: "none" }}>{view.name}</span>
          <span style={{ margin: "0 10px", color: "#ff7417" }}>·</span>
          <span style={{ textTransform: "none" }}>{view.size}</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 28,
            fontFamily: "Manrope",
            fontSize: 53,
            fontWeight: 600,
            letterSpacing: "-1.8px",
          }}
        >
          <CampaignAmount value={lowest} fontSize={53} letterSpacing="-1.8px" />
          {hasGap ? (
            <>
              <div
                style={{
                  width: 62,
                  height: 53,
                  margin: "0 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 62,
                    height: 2,
                    display: "flex",
                    background: "rgba(255,250,244,.76)",
                  }}
                />
              </div>
              <CampaignAmount
                value={highest}
                fontSize={53}
                letterSpacing="-1.8px"
              />
            </>
          ) : null}
        </div>
        <span
          style={{
            marginTop: 22,
            fontFamily: "Manrope",
            fontSize: 25,
            color: "rgba(255,250,244,.76)",
          }}
        >
          {hasGap ? "Compare current prices" : "See the current listing"}
        </span>
      </div>

      <ProductStage packshotSrc={packshotSrc} />
      <StoryFooter observedAt={view.observedAt} />
    </div>
  );
}

function scaleCurve(points: TrendPricePoint[]) {
  const width = 800;
  const height = 370;
  const xs = points.map((point) => Date.parse(point.observedAt));
  const ys = points.map((point) => point.priceNaira);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  return points.map((point) => ({
    x: 20 + ((Date.parse(point.observedAt) - minX) / xRange) * (width - 40),
    y: 25 + (1 - (point.priceNaira - minY) / yRange) * (height - 70),
  }));
}

function movementHeadline(history: CampaignTrendHistory) {
  if (history.direction === "flat") return "Holding steady.";
  const magnitude = Math.abs(history.percent);
  const percent = `${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`;
  return `${history.direction === "down" ? "Down" : "Up"} ${percent}.`;
}

function TrendCurve({ history }: { history: CampaignTrendHistory }) {
  const points = scaleCurve(history.points);
  const path = buildMonotoneCampaignPath(points);
  const area = `${path} L${points.at(-1)!.x.toFixed(1)},390 L${points[0].x.toFixed(1)},390 Z`;
  const accent = history.direction === "up" ? "#f09a8d" : "#87d6ad";
  return (
    <div
      style={{
        width: 840,
        height: 430,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 52% 62%, rgba(128,50,78,.26), rgba(18,8,12,0) 70%)",
      }}
    >
      <svg width="800" height="400" viewBox="0 0 800 400">
        <defs>
          <linearGradient id="story-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.26" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="story-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f2b8a7" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#story-area)" />
        <path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.13"
        />
        <path
          d={path}
          fill="none"
          stroke="url(#story-line)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={points[0].x} cy={points[0].y} r="8" fill="#f2b8a7" />
        <circle
          cx={points.at(-1)!.x}
          cy={points.at(-1)!.y}
          r="10"
          fill={accent}
        />
      </svg>
    </div>
  );
}

function TrendStats({ data }: { data: ProductTrendData }) {
  const stats = [
    ["Lowest", data.summary.lowestNaira],
    ["Typical", data.summary.medianNaira],
    ["Highest", data.summary.highestNaira],
  ] as const;
  return (
    <div
      style={{
        display: "flex",
        width: 840,
        justifyContent: "space-between",
        paddingTop: 34,
        borderTop: "1px solid rgba(255,250,244,.16)",
      }}
    >
      {stats.map(([label, value]) => (
        <div
          key={label}
          style={{
            width: 250,
            display: "flex",
            flexDirection: "column",
            fontFamily: "Manrope",
          }}
        >
          <span
            style={{
              color: "rgba(255,250,244,.55)",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "2.4px",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
          <span style={{ marginTop: 8, display: "flex" }}>
            {value == null ? (
              <span
                style={{
                  color: "#fffaf4",
                  fontFamily: "Manrope",
                  fontSize: 34,
                  fontWeight: 600,
                }}
              >
                —
              </span>
            ) : (
              <CampaignAmount value={naira.format(value)} fontSize={34} />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrendStory({
  data,
  packshotSrc,
  referenceNow,
  windowKey,
}: {
  data: ProductTrendData;
  packshotSrc: string;
  referenceNow: number;
  windowKey: TrendWindowKey;
}) {
  const story = buildCampaignTrendStory(data, referenceNow, windowKey);
  const isHistory = story.mode === "history";
  const observedAt = isHistory ? story.endObservedAt : story.observedAt;
  const windowLabel = trendWindowDefinition(windowKey).label;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 76% 15%, #32101d 0%, #14090e 32%, #070607 64%, #020202 100%)",
        color: "#fffaf4",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 240,
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
          {windowLabel} price movement
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 390,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 76,
            lineHeight: 1,
            letterSpacing: "-2px",
          }}
        >
          {isHistory ? movementHeadline(story) : "Current market snapshot."}
        </span>
        <div
          style={{
            marginTop: 25,
            maxWidth: 760,
            display: "flex",
            flexDirection: "column",
            fontFamily: "Manrope",
            fontSize: 24,
            lineHeight: 1.42,
            color: "rgba(255,250,244,.72)",
          }}
        >
          {isHistory ? (
            <div
              style={{ display: "flex" }}
            >{`${story.retailer} · ${shortDate.format(new Date(story.startObservedAt))} to ${shortDate.format(new Date(story.endObservedAt))}`}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex" }}>
                More dated observations will draw the curve.
              </div>
              <div style={{ display: "flex" }}>
                Today’s verified range stays useful.
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 615,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {isHistory ? (
          <TrendCurve history={story} />
        ) : (
          <div
            style={{
              width: 840,
              height: 430,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background:
                "radial-gradient(ellipse at center, rgba(235,132,151,.18) 0%, rgba(18,8,12,0) 68%)",
            }}
          >
            <div
              style={{
                width: 720,
                height: 4,
                display: "flex",
                background:
                  "linear-gradient(90deg, rgba(242,184,167,.45), #f09a8d 52%, #87d6ad)",
                borderRadius: 999,
              }}
            />
            {[60, 420, 780].map((left, index) => (
              <div
                key={left}
                style={{
                  position: "absolute",
                  left,
                  top: 202,
                  width: index === 1 ? 18 : 13,
                  height: index === 1 ? 18 : 13,
                  borderRadius: 999,
                  background: index === 2 ? "#87d6ad" : "#f2b8a7",
                  boxShadow: "0 0 34px rgba(240,154,141,.5)",
                }}
              />
            ))}
          </div>
        )}
        <TrendStats data={data} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          top: 1215,
          width: 455,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            color: "#ef9b8e",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
          }}
        >
          {data.brand}
        </span>
        <span
          style={{
            marginTop: 14,
            fontFamily: "Italiana",
            fontSize: 46,
            lineHeight: 1.08,
          }}
        >
          {data.name}
        </span>
        <span
          style={{
            marginTop: 18,
            fontFamily: "Manrope",
            fontSize: 21,
            color: "rgba(255,250,244,.62)",
          }}
        >
          {formatCampaignProductSize(data.slug, data.size)} ·{" "}
          {data.summary.storeCount}{" "}
          {data.summary.storeCount === 1 ? "store" : "stores"}
        </span>
      </div>
      <ProductStage packshotSrc={packshotSrc} compact />
      <StoryFooter observedAt={observedAt} />
    </div>
  );
}

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const searchParams = new URL(request.url).searchParams;
  const kind = searchParams.get("kind") as StoryKind | null;
  if (kind !== "price" && kind !== "trend") {
    return errorResponse("Choose a price or trend story.", 400);
  }
  const requestedWindow = searchParams.get("window");
  if (
    kind === "trend" &&
    requestedWindow &&
    !isTrendWindowKey(requestedWindow)
  ) {
    return errorResponse("Choose a valid trend window.", 400);
  }
  const windowKey = isTrendWindowKey(requestedWindow)
    ? requestedWindow
    : DEFAULT_TREND_WINDOW;

  const [shareData, trendData, fonts] = await Promise.all([
    buildShareData(slug),
    kind === "trend" ? getProductTrendData(slug) : Promise.resolve(null),
    loadOgFonts(),
  ]);
  if (!shareData) return errorResponse("This product is not shareable.", 404);
  if (kind === "trend" && !trendData) {
    return errorResponse("Trend data is not available for this product.", 404);
  }

  const packshotSrc = await loadImage(absoluteImage(shareData.view.image));
  if (!packshotSrc) {
    return errorResponse(
      "The approved product image could not be loaded.",
      503,
    );
  }

  const body =
    kind === "price" ? (
      <PriceStory data={shareData} packshotSrc={packshotSrc} />
    ) : (
      <TrendStory
        data={trendData!}
        packshotSrc={packshotSrc}
        referenceNow={
          trendData!.summary.observedAt
            ? Date.parse(trendData!.summary.observedAt)
            : Date.now()
        }
        windowKey={windowKey}
      />
    );
  const fileName = `${slug}-${kind}-story.png`.replace(/[^a-z0-9._-]+/gi, "-");

  return new ImageResponse(body, {
    ...CAMPAIGN_STORY_SIZE,
    fonts,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
