import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og/assets";
import { CAMPAIGN_STORY_SIZE } from "@/lib/share/campaign-story";

export const runtime = "nodejs";

type ScreenDef = {
  label: string;
  content: React.ReactNode;
};

type GuideDefinition = {
  slug: "order" | "bundle";
  title: string;
  eyebrow: string;
  screens: ScreenDef[];
};

/* ── Design tokens (match the page exactly) ── */

const CREAM = "#fbf3ed";
const PEACH = "#f4d4c5";
const ROSE = "#e8bbb4";
const INK = "#2d211f";
const WINE = "#6b3b35";
const WINE_DARK = "#4a2823";
const MUTED = "#7a6b66";
const WHITE60 = "rgba(255,255,255,0.6)";
const WHITE70 = "rgba(255,255,255,0.7)";
const ON_CREAM = "#fff7f4";
const PINK_ACCENT = "#ff9aa5";
const BORDER = "rgba(107,59,53,0.12)";
const BORDER_LIGHT = "rgba(107,59,53,0.08)";
const SEARCH_BG = "rgba(107,59,53,0.08)";

/* Phone dimensions — 9:19.5 aspect ratio like iPhone 17 */
const PHONE_W = 420;
const PHONE_H = 910; // 420 * 19.5/9
const BEZEL = 7;
const SCREEN_RADIUS = 40;
const FRAME_RADIUS = 50;

/* ── Phone frame with titanium finish ── */

function Phone({ screen }: { screen: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: FRAME_RADIUS,
        background: "linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 100%)",
        padding: BEZEL,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxShadow:
          "0 30px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {/* Side buttons — left */}
      <div
        style={{
          position: "absolute",
          left: -2,
          top: 250,
          width: 3,
          height: 120,
          borderRadius: 2,
          background: "#1a1a1e",
        }}
      />
      {/* Side buttons — right top */}
      <div
        style={{
          position: "absolute",
          right: -2,
          top: 200,
          width: 3,
          height: 80,
          borderRadius: 2,
          background: "#1a1a1e",
        }}
      />
      {/* Side buttons — right bottom */}
      <div
        style={{
          position: "absolute",
          right: -2,
          top: 320,
          width: 3,
          height: 80,
          borderRadius: 2,
          background: "#1a1a1e",
        }}
      />
      {/* Screen */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: SCREEN_RADIUS,
          background: `linear-gradient(180deg, ${CREAM} 0%, ${PEACH} 100%)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 12,
            height: 48,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 130,
              height: 34,
              borderRadius: 17,
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
            padding: "0 28px 4px",
            height: 32,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 16,
              fontWeight: 600,
              color: INK,
            }}
          >
            9:41
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 11,
              color: MUTED,
              letterSpacing: "2px",
            }}
          >
            5G
          </span>
        </div>
        {screen}
      </div>
    </div>
  );
}

/* ── Shared screen elements ── */

function TabBar({ active }: { active: string }) {
  const tabs = ["Products", "Basket", "Me"];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "10px 0",
        borderTop: `1px solid ${BORDER_LIGHT}`,
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => (
        <span
          key={tab}
          style={{
            fontFamily: "Manrope",
            fontSize: 12,
            fontWeight: tab === active ? 600 : 500,
            color: tab === active ? INK : MUTED,
          }}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

function ProductTile({
  brand,
  name,
  price,
  dark,
}: {
  brand: string;
  name: string;
  price: string;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        borderRadius: 14,
        background: dark ? INK : WHITE60,
      }}
    >
      {/* Product image placeholder */}
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: 10,
          background: dark
            ? `linear-gradient(135deg, ${WINE} 0%, ${WINE_DARK} 100%)`
            : `linear-gradient(135deg, ${PEACH} 0%, ${ROSE} 100%)`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 10,
            fontWeight: 600,
            color: dark ? ON_CREAM : INK,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {brand}
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 11,
            color: dark ? "rgba(255,247,244,0.7)" : MUTED,
            lineHeight: 1.2,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 12,
            fontWeight: 600,
            color: dark ? PINK_ACCENT : WINE,
          }}
        >
          {price}
        </span>
      </div>
    </div>
  );
}

function PrimaryButton({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 16px",
        borderRadius: 999,
        background: INK,
      }}
    >
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 13,
          fontWeight: 600,
          color: ON_CREAM,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        background: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 22,
          height: 12,
          borderBottom: `3px solid ${ON_CREAM}`,
          borderLeft: `3px solid ${ON_CREAM}`,
          transform: "rotate(-45deg) translate(2px, -2px)",
        }}
      />
    </div>
  );
}

function ProgressSteps({ doneCount }: { doneCount: number }) {
  const steps = ["Paid", "Procuring", "Delivering"];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
      }}
    >
      {steps.map((step, i) => (
        <div
          key={step}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              background: i < doneCount ? INK : "transparent",
              border: i < doneCount ? "none" : `1px solid ${BORDER}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 13,
              fontWeight: i < doneCount ? 600 : 500,
              color: i < doneCount ? INK : MUTED,
            }}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Order flow screens ── */

function OrderBrowseScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Title + search */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "8px 28px 12px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 32,
            color: INK,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Products
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 32,
            borderRadius: 16,
            background: SEARCH_BG,
            paddingLeft: 14,
          }}
        >
          <span style={{ fontFamily: "Manrope", fontSize: 12, color: MUTED }}>
            Search skincare...
          </span>
        </div>
      </div>
      {/* Product grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "0 28px",
          flex: 1,
          alignContent: "flex-start",
        }}
      >
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="COSRX" name="Cleanser" price="12,500" />
        </div>
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="Anua" name="Niacinamide" price="18,900" dark />
        </div>
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="PanOxyl" name="Benzoyl Wash" price="15,300" />
        </div>
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="Dove" name="Argan Bar" price="4,500" dark />
        </div>
      </div>
      <div style={{ padding: "0 28px", flexShrink: 0, display: "flex" }}>
        <TabBar active="Products" />
      </div>
    </div>
  );
}

function OrderProductScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Product hero image */}
      <div
        style={{
          width: 350,
          height: 292,
          background: `linear-gradient(135deg, ${PEACH} 0%, ${ROSE} 100%)`,
          margin: "0 28px",
          borderRadius: 18,
          flexShrink: 0,
        }}
      />
      {/* Product info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "16px 28px 0",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 12,
            fontWeight: 600,
            color: WINE,
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          COSRX
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 16,
            fontWeight: 600,
            color: INK,
            lineHeight: 1.3,
          }}
        >
          Salicylic Acid Daily Gentle Cleanser
        </span>
        <span style={{ fontFamily: "Manrope", fontSize: 12, color: MUTED }}>
          150 ml
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 22,
              fontWeight: 600,
              color: INK,
            }}
          >
            NGN 12,500
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 14,
              color: MUTED,
              textDecoration: "line-through",
            }}
          >
            15,000
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: INK,
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: "Manrope", fontSize: 12, color: MUTED }}>
            3 Nigerian stores
          </span>
        </div>
      </div>
      {/* CTA */}
      <div
        style={{
          padding: "16px 28px 12px",
          flexShrink: 0,
          marginTop: "auto",
          display: "flex",
        }}
      >
        <PrimaryButton label="Add to basket" />
      </div>
      <div style={{ padding: "0 28px", flexShrink: 0, display: "flex" }}>
        <TabBar active="Products" />
      </div>
    </div>
  );
}

function OrderBasketScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          padding: "8px 28px 16px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 32,
            color: INK,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Your basket
        </span>
      </div>
      {/* Basket item */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          padding: "0 28px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${PEACH} 0%, ${ROSE} 100%)`,
            flexShrink: 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 12,
              fontWeight: 600,
              color: INK,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            COSRX
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 13,
              color: MUTED,
            }}
          >
            Salicylic Acid Cleanser
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 14,
              fontWeight: 600,
              color: WINE,
            }}
          >
            NGN 12,500
          </span>
        </div>
      </div>
      {/* Divider */}
      <div
        style={{
          height: 1,
          background: BORDER,
          margin: "20px 28px",
          flexShrink: 0,
        }}
      />
      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 28px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 16,
            color: MUTED,
          }}
        >
          Total
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 22,
            fontWeight: 600,
            color: INK,
          }}
        >
          NGN 12,500
        </span>
      </div>
      {/* CTA */}
      <div
        style={{
          padding: "20px 28px 12px",
          flexShrink: 0,
          marginTop: "auto",
          display: "flex",
        }}
      >
        <PrimaryButton label="Request quote" />
      </div>
      <div style={{ padding: "0 28px", flexShrink: 0, display: "flex" }}>
        <TabBar active="Basket" />
      </div>
    </div>
  );
}

function OrderConfirmScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 20,
        padding: "0 28px",
      }}
    >
      <CheckIcon />
      <span
        style={{
          fontFamily: "Italiana",
          fontSize: 28,
          color: INK,
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        Order confirmed
      </span>
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 13,
          color: MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        We are procuring your product from the retailer.
      </span>
      <ProgressSteps doneCount={2} />
      <div style={{ width: 220, marginTop: 8, display: "flex" }}>
        <PrimaryButton label="Track order" />
      </div>
      <div style={{ width: "100%", marginTop: 8, display: "flex" }}>
        <TabBar active="Me" />
      </div>
    </div>
  );
}

/* ── Bundle flow screens ── */

function BundlePickScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 28px 12px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 32,
            color: INK,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Build a bundle
        </span>
        <span style={{ fontFamily: "Manrope", fontSize: 12, color: MUTED }}>
          Pick products from any store
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "0 28px",
          flex: 1,
          alignContent: "flex-start",
        }}
      >
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="COSRX" name="Cleanser" price="12,500" dark />
        </div>
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="Anua" name="Niacinamide" price="18,900" />
        </div>
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="B.LAB" name="Sunscreen" price="9,800" dark />
        </div>
        <div style={{ width: 171, display: "flex" }}>
          <ProductTile brand="Dove" name="Body Bar" price="4,500" />
        </div>
      </div>
      <div style={{ padding: "0 28px", flexShrink: 0, display: "flex" }}>
        <TabBar active="Basket" />
      </div>
    </div>
  );
}

function BundleRoutineScreen() {
  const steps = [
    { num: "1", label: "Cleanse", brand: "COSRX" },
    { num: "2", label: "Treat", brand: "Anua" },
    { num: "3", label: "Protect", brand: "B.LAB" },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          padding: "8px 28px 16px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 32,
            color: INK,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Your routine
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "0 28px",
          flex: 1,
        }}
      >
        {steps.map((step) => (
          <div
            key={step.num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: 16,
              background: WHITE60,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: INK,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "Manrope",
                  fontSize: 16,
                  fontWeight: 600,
                  color: ON_CREAM,
                }}
              >
                {step.num}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontFamily: "Manrope",
                  fontSize: 15,
                  fontWeight: 600,
                  color: INK,
                }}
              >
                {step.label}
              </span>
              <span
                style={{ fontFamily: "Manrope", fontSize: 12, color: MUTED }}
              >
                {step.brand}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          height: 1,
          background: BORDER,
          margin: "12px 28px",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 28px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "Manrope", fontSize: 14, color: MUTED }}>
          3 products
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 22,
            fontWeight: 600,
            color: INK,
          }}
        >
          NGN 41,200
        </span>
      </div>
      <div
        style={{
          padding: "16px 28px 12px",
          flexShrink: 0,
          marginTop: "auto",
          display: "flex",
        }}
      >
        <PrimaryButton label="Get single quote" />
      </div>
      <div style={{ padding: "0 28px", flexShrink: 0, display: "flex" }}>
        <TabBar active="Basket" />
      </div>
    </div>
  );
}

function BundleQuoteScreen() {
  const items = [
    { name: "COSRX Cleanser", price: "12,500" },
    { name: "Anua Niacinamide", price: "18,900" },
    { name: "B.LAB Sunscreen", price: "9,800" },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          padding: "8px 28px 16px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 32,
            color: INK,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Bundle quote
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "0 28px",
          flex: 1,
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 0",
              borderBottom:
                i < items.length - 1 ? `1px solid ${BORDER}` : "none",
            }}
          >
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 14,
                fontWeight: 600,
                color: INK,
              }}
            >
              {item.name}
            </span>
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 14,
                fontWeight: 600,
                color: WINE,
              }}
            >
              {item.price}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          height: 1,
          background: BORDER,
          margin: "8px 28px",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 28px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 16,
            color: MUTED,
          }}
        >
          Total
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 22,
            fontWeight: 600,
            color: INK,
          }}
        >
          NGN 41,200
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 28px 12px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: INK,
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: "Manrope", fontSize: 12, color: MUTED }}>
          One delivery. One return window.
        </span>
      </div>
      <div
        style={{
          padding: "0 28px 12px",
          flexShrink: 0,
          display: "flex",
        }}
      >
        <PrimaryButton label="Order bundle" />
      </div>
      <div style={{ padding: "0 28px", flexShrink: 0, display: "flex" }}>
        <TabBar active="Basket" />
      </div>
    </div>
  );
}

function BundleConfirmScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 20,
        padding: "0 28px",
      }}
    >
      <CheckIcon />
      <span
        style={{
          fontFamily: "Italiana",
          fontSize: 28,
          color: INK,
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        Bundle ordered
      </span>
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 13,
          color: MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        3 products procured from 2 stores. One delivery.
      </span>
      <ProgressSteps doneCount={2} />
      <div style={{ width: 220, marginTop: 8, display: "flex" }}>
        <PrimaryButton label="Track bundle" />
      </div>
      <div style={{ width: "100%", marginTop: 8, display: "flex" }}>
        <TabBar active="Me" />
      </div>
    </div>
  );
}

/* ── Guide definitions ── */

const GUIDES: Record<string, GuideDefinition> = {
  order: {
    slug: "order",
    title: "How to order.",
    eyebrow: "JeloCare guided ordering",
    screens: [
      { label: "Browse", content: <OrderBrowseScreen /> },
      { label: "Product", content: <OrderProductScreen /> },
      { label: "Basket", content: <OrderBasketScreen /> },
      { label: "Confirmed", content: <OrderConfirmScreen /> },
    ],
  },
  bundle: {
    slug: "bundle",
    title: "How to bundle.",
    eyebrow: "JeloCare bundle builder",
    screens: [
      { label: "Pick", content: <BundlePickScreen /> },
      { label: "Routine", content: <BundleRoutineScreen /> },
      { label: "Quote", content: <BundleQuoteScreen /> },
      { label: "Ordered", content: <BundleConfirmScreen /> },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

/* ── Story card layout ── */

function GuideStory({ guide }: { guide: GuideDefinition }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 30%, #2d211f 0%, #1a1218 40%, #0d0a0e 72%, #000 100%)",
        color: "#fffaf4",
      }}
    >
      {/* Header — JeloCare mark + eyebrow */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "60px 80px 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
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
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "rgba(255,250,244,0.5)",
          }}
        >
          {guide.eyebrow}
        </span>
      </div>

      {/* Guide title */}
      <div
        style={{
          display: "flex",
          padding: "12px 80px 0",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 64,
            color: "#fffaf4",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          {guide.title}
        </span>
      </div>

      {/* 2x2 phone grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 30,
          padding: "40px 80px",
          flex: 1,
          alignContent: "center",
        }}
      >
        {guide.screens.map((screen) => (
          <Phone key={screen.label} screen={screen.content} />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px 60px",
          color: "rgba(255,250,244,0.5)",
          fontFamily: "Manrope",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        <span>jelocare.com</span>
        <span>4 steps · 1 order</span>
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
