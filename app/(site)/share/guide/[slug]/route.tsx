import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og/assets";
import { CAMPAIGN_STORY_SIZE } from "@/lib/share/campaign-story";

export const runtime = "nodejs";

type GuideStep = {
  step: number;
  title: string;
  subtitle: string;
};

type GuideDefinition = {
  slug: "order" | "bundle";
  title: string;
  eyebrow: string;
  steps: GuideStep[];
};

const GUIDES: Record<string, GuideDefinition> = {
  order: {
    slug: "order",
    title: "How to order.",
    eyebrow: "JeloCare guided ordering",
    steps: [
      {
        step: 1,
        title: "Find your product",
        subtitle: "Browse exact Nigerian listings with real prices.",
      },
      {
        step: 2,
        title: "Add to basket",
        subtitle: "Pick the store and price that works for you.",
      },
      {
        step: 3,
        title: "Request a quote",
        subtitle: "We confirm availability and total cost.",
      },
      {
        step: 4,
        title: "Pay and receive",
        subtitle: "Secure payment, procurement, and delivery.",
      },
    ],
  },
  bundle: {
    slug: "bundle",
    title: "How to bundle.",
    eyebrow: "JeloCare bundle builder",
    steps: [
      {
        step: 1,
        title: "Pick your products",
        subtitle: "Select items from different retailers.",
      },
      {
        step: 2,
        title: "Build your bundle",
        subtitle: "We check compatibility and stock across stores.",
      },
      {
        step: 3,
        title: "Save and share",
        subtitle: "Get a single quote for the whole routine.",
      },
      {
        step: 4,
        title: "Order in one go",
        subtitle: "One payment, one delivery, one return window.",
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

/**
 * iPhone 17 mockup frame — stylised device with Dynamic Island,
 * rounded screen, and the JeloCare app flow inside.
 *
 * The device is drawn entirely with CSS (no external images).
 * The screen shows 4 stylised steps in the JeloCare brand language.
 */
function PhoneMockup({ guide }: { guide: GuideDefinition }) {
  // Device dimensions (scaled to fit within 1080x1920)
  const deviceWidth = 820;
  const deviceHeight = 1620;
  const deviceX = (1080 - deviceWidth) / 2;
  const deviceY = 150;

  // Screen padding (inside the bezel)
  const screenPadding = 24;

  return (
    <div
      style={{
        position: "absolute",
        left: deviceX,
        top: deviceY,
        width: deviceWidth,
        height: deviceHeight,
        borderRadius: 80,
        background: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        padding: screenPadding,
        boxShadow: "0 60px 120px rgba(0,0,0,.5)",
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 56,
          background: "linear-gradient(180deg, #fbf3ed 0%, #f4d4c5 100%)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dynamic Island — rendered first so it appears above status bar naturally */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 18,
            height: 74,
          }}
        >
          <div
            style={{
              width: 220,
              height: 56,
              borderRadius: 28,
              background: "#000",
            }}
          />
        </div>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 40px",
            height: 40,
          }}
        >
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 24,
              fontWeight: 600,
              color: "#2d211f",
            }}
          >
            9:41
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 18,
              color: "#7a6b66",
              letterSpacing: "3px",
            }}
          >
            5G
          </span>
        </div>

        {/* App header */}
        <div
          style={{
            padding: "20px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 18,
              fontWeight: 600,
              color: "#6b3b35",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {guide.eyebrow}
          </span>
          <span
            style={{
              fontFamily: "Italiana",
              fontSize: 52,
              color: "#2d211f",
              lineHeight: 1.05,
            }}
          >
            {guide.title}
          </span>
        </div>

        {/* Steps */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            padding: "16px 40px 40px",
          }}
        >
          {guide.steps.map((step, index) => (
            <div
              key={step.step}
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                padding: 24,
                borderRadius: 32,
                background: index === 0 ? "#2d211f" : "rgba(255,255,255,.7)",
              }}
            >
              {/* Step number circle */}
              <div
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: index === 0 ? "#ff9aa5" : "rgba(107,59,53,.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Manrope",
                  fontSize: 24,
                  fontWeight: 600,
                  color: index === 0 ? "#2d211f" : "#6b3b35",
                }}
              >
                {step.step}
              </div>
              {/* Step text */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "Manrope",
                    fontSize: 26,
                    fontWeight: 600,
                    color: index === 0 ? "#fff7f4" : "#2d211f",
                  }}
                >
                  {step.title}
                </span>
                <span
                  style={{
                    fontFamily: "Manrope",
                    fontSize: 20,
                    color: index === 0 ? "rgba(255,247,244,.72)" : "#7a6b66",
                    lineHeight: 1.4,
                  }}
                >
                  {step.subtitle}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0 0 16px",
          }}
        >
          <div
            style={{
              width: 200,
              height: 8,
              borderRadius: 4,
              background: "#2d211f",
              opacity: 0.3,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function GuideStory({ guide }: { guide: GuideDefinition }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 30%, #2d211f 0%, #1a1218 40%, #0d0a0e 72%, #000 100%)",
        color: "#fffaf4",
      }}
    >
      {/* JeloCare mark — top */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 60,
          display: "flex",
          alignItems: "baseline",
          fontFamily: "Manrope",
          fontSize: 36,
          letterSpacing: "-1.4px",
          color: "#fffaf4",
        }}
      >
        <span style={{ fontWeight: 600 }}>Jelo</span>
        <span style={{ fontWeight: 400, opacity: 0.9 }}>Care</span>
      </div>

      {/* Guide title — top right */}
      <span
        style={{
          position: "absolute",
          right: 80,
          top: 68,
          fontFamily: "Manrope",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
          color: "rgba(255,250,244,.6)",
        }}
      >
        {guide.eyebrow}
      </span>

      {/* Phone mockup */}
      <PhoneMockup guide={guide} />

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,250,244,.5)",
          fontFamily: "Manrope",
          fontSize: 20,
        }}
      >
        <span>jelocare.com</span>
        <span>{guide.title}</span>
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const guide = GUIDES[slug];
  if (!guide) {
    return new Response("Guide not found.", { status: 404 });
  }

  const fonts = await loadOgFonts();
  const fileName = `${slug}-guide.png`;

  return new ImageResponse(<GuideStory guide={guide} />, {
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
