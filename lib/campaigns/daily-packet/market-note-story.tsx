import type { ShareData } from "@/app/(site)/share/[slug]/share-data";
import { CampaignAmount, JeloCareMark } from "./og-primitives";

export function MarketNoteStory({
  data,
  packshotSrc,
}: {
  data: ShareData;
  packshotSrc: string;
}) {
  const { view } = data;
  const lowest = view.offers[0]?.priceLabel ?? "—";
  const highest = view.offers.at(-1)?.priceLabel ?? lowest;
  const noteNameSize =
    view.name.length > 50 ? 29 : view.name.length > 34 ? 34 : 39;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 24% 70%, #6a2830 0%, #2d1118 33%, #13090d 65%, #070506 100%)",
        color: "#fffaf4",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 104,
          right: 104,
          top: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <JeloCareMark />
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "2.8px",
            textTransform: "uppercase",
            color: "#ef9eae",
          }}
        >
          Today’s market note
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 104,
          top: 265,
          width: 670,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            fontFamily: "Italiana",
            fontSize: 84,
            lineHeight: 0.98,
            letterSpacing: "-2.8px",
          }}
        >
          Keep the context.
        </span>
        <span
          style={{
            marginTop: 26,
            fontFamily: "Manrope",
            fontSize: 23,
            lineHeight: 1.45,
            color: "rgba(255,250,244,.68)",
          }}
        >
          One exact product. Current observed listings.
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 26,
          top: 735,
          width: 535,
          height: 780,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse at center, rgba(247,155,173,.28) 0%, rgba(115,39,51,.16) 45%, rgba(0,0,0,0) 72%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={packshotSrc}
          alt=""
          width={500}
          height={690}
          style={{
            width: 500,
            height: 690,
            objectFit: "contain",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 105,
          top: 1455,
          width: 340,
          height: 70,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,.7) 0%, rgba(0,0,0,.28) 48%, rgba(0,0,0,0) 75%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 74,
          top: 530,
          width: 500,
          minHeight: 1050,
          display: "flex",
          flexDirection: "column",
          padding: "54px 46px 48px",
          borderRadius: 22,
          background: "#fff9ef",
          color: "#2a211e",
          boxShadow: "0 52px 120px rgba(0,0,0,.52)",
          transform: "rotate(2.4deg)",
        }}
      >
        <span
          style={{
            fontFamily: "Manrope",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "2.6px",
            textTransform: "uppercase",
            color: "#a25b68",
          }}
        >
          JeloCare · Market note
        </span>
        <span
          style={{
            marginTop: 26,
            fontFamily: "Manrope",
            fontSize: noteNameSize,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: "-1.3px",
          }}
        >
          {view.brand} {view.name}
        </span>
        <span
          style={{
            marginTop: 12,
            fontFamily: "Manrope",
            fontSize: 18,
            color: "#7f6f69",
          }}
        >
          {view.size} · Observed {view.observedDate}
        </span>

        <div
          style={{
            marginTop: 35,
            height: 2,
            display: "flex",
            background:
              "repeating-linear-gradient(90deg, #ccb9af 0 10px, transparent 10px 18px)",
          }}
        />

        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {view.offers.slice(0, 3).map((offer) => (
            <div
              key={`${offer.retailer}-${offer.priceLabel}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  width: 245,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    fontFamily: "Manrope",
                    fontSize: offer.retailer.length > 25 ? 17 : 20,
                    fontWeight: 600,
                    lineHeight: 1.15,
                  }}
                >
                  {offer.retailer}
                </span>
                <span
                  style={{
                    marginTop: 7,
                    fontFamily: "Manrope",
                    fontSize: 13,
                    color: "#8c7b75",
                  }}
                >
                  {offer.when}
                </span>
              </div>
              <CampaignAmount
                value={offer.priceLabel}
                color="#2a211e"
                fontSize={25}
                letterSpacing="-.8px"
              />
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 34,
            height: 2,
            display: "flex",
            background:
              "repeating-linear-gradient(90deg, #ccb9af 0 10px, transparent 10px 18px)",
          }}
        />

        <span
          style={{
            marginTop: 27,
            fontFamily: "Manrope",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "2.2px",
            textTransform: "uppercase",
            color: "#a25b68",
          }}
        >
          Observed range
        </span>
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
          }}
        >
          <CampaignAmount
            value={lowest}
            color="#2a211e"
            fontSize={31}
            letterSpacing="-1px"
          />
          {view.offers.length > 1 ? (
            <>
              <span style={{ margin: "0 10px", color: "#ad9b94" }}>—</span>
              <CampaignAmount
                value={highest}
                color="#2a211e"
                fontSize={31}
                letterSpacing="-1px"
              />
            </>
          ) : null}
        </div>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 30,
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid #dfd1c8",
            fontFamily: "Manrope",
            fontSize: 14,
            lineHeight: 1.5,
            color: "#7e6f69",
          }}
        >
          <span>Reference only · Not a checkout</span>
          <span>Prices change.</span>
        </div>
      </div>
    </div>
  );
}
