import type { CampaignPillar } from "@/lib/campaigns/daily-campaign-editorial";

const palette = {
  market: {
    accent: "#ff9aa5",
    glow: "rgba(255,92,118,.32)",
    panel: "#2a1118",
    number: "01",
  },
  useful: {
    accent: "#ffc4a1",
    glow: "rgba(255,126,58,.30)",
    panel: "#25140d",
    number: "02",
  },
  relatable: {
    accent: "#d9c6ff",
    glow: "rgba(145,102,255,.34)",
    panel: "#1d142c",
    number: "03",
  },
} as const;

export function ReviewPillarStory({ pillar }: { pillar: CampaignPillar }) {
  const theme = palette[pillar.kind];
  const headlineSize =
    pillar.headline.length > 55 ? 78 : pillar.headline.length > 38 ? 90 : 104;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 18% 82%, #501d29 0%, #210b12 32%, #0c0709 67%, #030303 100%)",
        color: "#fffaf4",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 820,
          height: 820,
          right: -310,
          top: 160,
          borderRadius: 999,
          background: `radial-gradient(circle, ${theme.glow} 0%, rgba(0,0,0,0) 69%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 92,
          right: 92,
          top: 112,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          JeloCare · Daily three · {theme.number}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 92,
          right: 92,
          top: 350,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "3.6px",
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          {pillar.label} · {pillar.eyebrow}
        </span>
        <span
          style={{
            marginTop: 40,
            maxWidth: 900,
            fontFamily: "Italiana",
            fontSize: headlineSize,
            lineHeight: 0.98,
            letterSpacing: "-3px",
          }}
        >
          {pillar.headline}
        </span>
        <span
          style={{
            marginTop: 42,
            maxWidth: 800,
            fontFamily: "Manrope",
            fontSize: 31,
            lineHeight: 1.45,
            color: "rgba(255,250,244,.72)",
          }}
        >
          {pillar.body}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: 110,
          minHeight: 440,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px 56px",
          borderRadius: 44,
          background: theme.panel,
          border: `2px solid ${theme.accent}33`,
          boxShadow: "0 42px 110px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: theme.accent,
            }}
          >
            {pillar.kind === "market"
              ? "Evidence before urgency"
              : pillar.kind === "useful"
                ? "What this means"
                : "The point"}
          </span>
          <span
            style={{
              marginTop: 18,
              fontFamily: "Manrope",
              fontSize: 24,
              lineHeight: 1.5,
              color: "rgba(255,250,244,.76)",
            }}
          >
            {pillar.footerNote}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 42,
          }}
        >
          <span
            style={{
              display: "flex",
              padding: "18px 28px",
              borderRadius: 999,
              background: theme.accent,
              color: "#21070d",
              fontFamily: "Manrope",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {pillar.action}
          </span>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 20,
              color: "rgba(255,250,244,.58)",
            }}
          >
            jelocare.com
          </span>
        </div>
      </div>
    </div>
  );
}
