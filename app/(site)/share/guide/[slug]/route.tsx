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

/* ── Shared style constants ── */

const CREAM = "#fbf3ed";
const PEACH = "#f4d4c5";
const INK = "#2d211f";
const WINE = "#6b3b35";
const MUTED = "#7a6b66";
const WHITE70 = "rgba(255,255,255,0.7)";
const WHITE42 = "rgba(255,255,255,0.42)";
const BORDER = "rgba(107,59,53,0.12)";

const PHONE_W = 440;
const PHONE_H = 640;
const BEZEL = 14;
const SCREEN_RADIUS = 36;
const FRAME_RADIUS = 48;

/* ── Reusable screen elements ── */

function StatusBar() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 24px",
        height: 28,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 15,
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
  );
}

function DynamicIsland() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 10,
        height: 44,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 120,
          height: 30,
          borderRadius: 15,
          background: "#000",
        }}
      />
    </div>
  );
}

function TabBar({ active }: { active: string }) {
  const tabs = ["Products", "Basket", "Me"];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: 36,
        flexShrink: 0,
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      {tabs.map((tab) => (
        <span
          key={tab}
          style={{
            fontFamily: "Manrope",
            fontSize: 11,
            fontWeight: 600,
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
  bg,
}: {
  brand: string;
  name: string;
  price: string;
  bg: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        background: WHITE70,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 80, background: bg }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "8px 10px",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 10,
            fontWeight: 600,
            color: WINE,
            letterSpacing: "0.5px",
          }}
        >
          {brand}
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 11,
            fontWeight: 600,
            color: INK,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 12,
            fontWeight: 600,
            color: INK,
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
        height: 36,
        borderRadius: 18,
        background: INK,
      }}
    >
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function CheckIcon() {
  // Draw a checkmark with two rotated divs since ✓ char isn't in the font
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        background: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 20,
          height: 10,
          borderBottom: `3px solid #fff`,
          borderLeft: `3px solid #fff`,
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
        gap: 10,
      }}
    >
      {steps.map((step, i) => (
        <div
          key={step}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: i < doneCount ? INK : BORDER,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 12,
              fontWeight: 600,
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

/* ── Phone frame wrapper ── */

function Phone({ screen }: { screen: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: FRAME_RADIUS,
        background: "#1a1a1a",
        padding: BEZEL,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: SCREEN_RADIUS,
          background: `linear-gradient(180deg, ${CREAM} 0%, ${PEACH} 100%)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <DynamicIsland />
        <StatusBar />
        {screen}
      </div>
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "8px 24px 12px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 28,
            color: INK,
            lineHeight: 1.1,
          }}
        >
          Products
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 28,
            borderRadius: 14,
            background: WHITE42,
            marginTop: 8,
            paddingLeft: 12,
          }}
        >
          <span style={{ fontFamily: "Manrope", fontSize: 11, color: MUTED }}>
            Search skincare...
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "0 24px",
          flex: 1,
          alignContent: "flex-start",
        }}
      >
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="COSRX"
            name="Cleanser"
            price="12,500"
            bg="#e8d5c8"
          />
        </div>
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="Anua"
            name="Niacinamide"
            price="18,900"
            bg="#d4c5e0"
          />
        </div>
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="PanOxyl"
            name="Benzoyl Wash"
            price="15,300"
            bg="#c8dce8"
          />
        </div>
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="Dove"
            name="Argan Bar"
            price="4,500"
            bg="#e8d8c8"
          />
        </div>
      </div>
      <div style={{ display: "flex", padding: "8px 24px 12px", flexShrink: 0 }}>
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
      <div
        style={{
          height: 180,
          background: "linear-gradient(135deg, #e8d5c8, #d4b8a8)",
          margin: "0 24px",
          borderRadius: 16,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "12px 24px 0",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 11,
            fontWeight: 600,
            color: WINE,
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          COSRX
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 14,
            fontWeight: 600,
            color: INK,
            lineHeight: 1.3,
          }}
        >
          Salicylic Acid Daily Gentle Cleanser
        </span>
        <span style={{ fontFamily: "Manrope", fontSize: 11, color: MUTED }}>
          150 ml
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 18,
              fontWeight: 600,
              color: INK,
            }}
          >
            NGN 12,500
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 12,
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
            gap: 6,
            marginTop: 4,
          }}
        >
          <div
            style={{ width: 8, height: 8, borderRadius: 4, background: WINE }}
          />
          <span style={{ fontFamily: "Manrope", fontSize: 11, color: MUTED }}>
            3 Nigerian stores
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          padding: "12px 24px 12px",
          flexShrink: 0,
          marginTop: "auto",
        }}
      >
        <PrimaryButton label="Add to basket" />
      </div>
      <div style={{ display: "flex", padding: "0 24px 12px", flexShrink: 0 }}>
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
      <div style={{ display: "flex", padding: "8px 24px 12px", flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 28,
            color: INK,
            lineHeight: 1.1,
          }}
        >
          Your basket
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "linear-gradient(135deg, #e8d5c8, #d4b8a8)",
            flexShrink: 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 11,
              fontWeight: 600,
              color: WINE,
            }}
          >
            COSRX
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 12,
              fontWeight: 600,
              color: INK,
            }}
          >
            Salicylic Acid Cleanser
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 13,
              fontWeight: 600,
              color: INK,
            }}
          >
            NGN 12,500
          </span>
        </div>
      </div>
      <div
        style={{
          height: 1,
          background: BORDER,
          margin: "16px 24px",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px",
          flexShrink: 0,
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
          Total
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            fontWeight: 600,
            color: INK,
          }}
        >
          NGN 12,500
        </span>
      </div>
      <div
        style={{
          display: "flex",
          padding: "16px 24px 12px",
          flexShrink: 0,
          marginTop: "auto",
        }}
      >
        <PrimaryButton label="Request quote" />
      </div>
      <div style={{ display: "flex", padding: "0 24px 12px", flexShrink: 0 }}>
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
        gap: 16,
        padding: "0 24px",
      }}
    >
      <CheckIcon />
      <span
        style={{
          fontFamily: "Italiana",
          fontSize: 24,
          color: INK,
          textAlign: "center",
        }}
      >
        Order confirmed
      </span>
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 12,
          color: MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        We are procuring your product from the retailer.
      </span>
      <ProgressSteps doneCount={2} />
      <div style={{ width: 200, marginTop: 8, display: "flex" }}>
        <PrimaryButton label="Track order" />
      </div>
      <div style={{ display: "flex", width: "100%", marginTop: 8 }}>
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
          padding: "8px 24px 12px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 28,
            color: INK,
            lineHeight: 1.1,
          }}
        >
          Build a bundle
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 11,
            color: MUTED,
            marginTop: 2,
          }}
        >
          Pick products from any store
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "0 24px",
          flex: 1,
          alignContent: "flex-start",
        }}
      >
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="COSRX"
            name="Cleanser"
            price="12,500"
            bg="#e8d5c8"
          />
        </div>
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="Anua"
            name="Niacinamide"
            price="18,900"
            bg="#d4c5e0"
          />
        </div>
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="B.LAB"
            name="Sunscreen"
            price="9,800"
            bg="#c8e8d5"
          />
        </div>
        <div style={{ width: 170, display: "flex" }}>
          <ProductTile
            brand="Dove"
            name="Body Bar"
            price="4,500"
            bg="#e8d8c8"
          />
        </div>
      </div>
      <div style={{ display: "flex", padding: "8px 24px 12px", flexShrink: 0 }}>
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
      <div style={{ display: "flex", padding: "8px 24px 12px", flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 28,
            color: INK,
            lineHeight: 1.1,
          }}
        >
          Your routine
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "0 24px",
          flex: 1,
        }}
      >
        {steps.map((step) => (
          <div
            key={step.num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 16,
              background: WHITE70,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
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
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {step.num}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontFamily: "Manrope",
                  fontSize: 13,
                  fontWeight: 600,
                  color: INK,
                }}
              >
                {step.label}
              </span>
              <span
                style={{ fontFamily: "Manrope", fontSize: 11, color: MUTED }}
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
          margin: "8px 24px",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "Manrope", fontSize: 13, color: MUTED }}>
          3 products
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
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
          padding: "12px 24px 12px",
          flexShrink: 0,
          marginTop: "auto",
        }}
      >
        <PrimaryButton label="Get single quote" />
      </div>
      <div style={{ display: "flex", padding: "0 24px 12px", flexShrink: 0 }}>
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
      <div style={{ display: "flex", padding: "8px 24px 12px", flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 28,
            color: INK,
            lineHeight: 1.1,
          }}
        >
          Bundle quote
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: "0 24px",
          flex: 1,
        }}
      >
        {items.map((item) => (
          <div
            key={item.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 12,
                fontWeight: 600,
                color: INK,
              }}
            >
              {item.name}
            </span>
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 12,
                fontWeight: 600,
                color: INK,
              }}
            >
              {item.price}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 24px",
          flexShrink: 0,
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
          Total
        </span>
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
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
          gap: 6,
          padding: "0 24px 12px",
          flexShrink: 0,
        }}
      >
        <div
          style={{ width: 8, height: 8, borderRadius: 4, background: WINE }}
        />
        <span style={{ fontFamily: "Manrope", fontSize: 11, color: MUTED }}>
          One delivery. One return window.
        </span>
      </div>
      <div style={{ display: "flex", padding: "0 24px 12px", flexShrink: 0 }}>
        <PrimaryButton label="Order bundle" />
      </div>
      <div style={{ display: "flex", padding: "0 24px 12px", flexShrink: 0 }}>
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
        gap: 16,
        padding: "0 24px",
      }}
    >
      <CheckIcon />
      <span
        style={{
          fontFamily: "Italiana",
          fontSize: 24,
          color: INK,
          textAlign: "center",
        }}
      >
        Bundle ordered
      </span>
      <span
        style={{
          fontFamily: "Manrope",
          fontSize: 12,
          color: MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        3 products procured from 2 stores. One delivery.
      </span>
      <ProgressSteps doneCount={2} />
      <div style={{ width: 200, marginTop: 8, display: "flex" }}>
        <PrimaryButton label="Track bundle" />
      </div>
      <div style={{ display: "flex", width: "100%", marginTop: 8 }}>
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
      {/* JeloCare mark + title */}
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
          padding: "8px 80px 0",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 56,
            color: "#fffaf4",
            lineHeight: 1.1,
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
          gap: 24,
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
