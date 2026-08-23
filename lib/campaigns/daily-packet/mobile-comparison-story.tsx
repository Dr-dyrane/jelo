import type { ShareData } from "@/app/(site)/share/[slug]/share-data";
import { CampaignAmount, JeloCareMark } from "./og-primitives";

export function MobileComparisonStory({
  data,
  packshotSrc,
}: {
  data: ShareData;
  packshotSrc: string;
}) {
  const { view } = data;
  const lowest = view.offers[0]?.priceLabel ?? "—";
  const highest = view.offers.at(-1)?.priceLabel ?? lowest;
  const nameSize = view.name.length > 52 ? 35 : view.name.length > 36 ? 39 : 43;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 78% 16%, #451728 0%, #210d16 34%, #090607 74%, #020202 100%)",
        color: "#fffaf4",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 100,
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
            color: "#f29aae",
          }}
        >
          Compare, clearly
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 104,
          right: 104,
          top: 220,
          height: 1560,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "10px solid rgba(255,250,244,.14)",
          borderRadius: 76,
          background: "#fff8f2",
          boxShadow: "0 42px 100px rgba(0,0,0,.48)",
          color: "#251a18",
        }}
      >
        <div
          style={{
            height: 116,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 58px",
            borderBottom: "1px solid #eadbd2",
          }}
        >
          <span
            style={{
              fontFamily: "Italiana",
              fontSize: 32,
              letterSpacing: "1.6px",
            }}
          >
            JELOCARE
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                width: 46,
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                border: "1px solid #dcc9bf",
                fontFamily: "Manrope",
                fontSize: 22,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22">
                <path
                  d="M6 16 16 6M8 6h8v8"
                  fill="none"
                  stroke="#2d201e"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              style={{
                width: 46,
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "#241816",
                color: "#fffaf4",
                fontFamily: "Manrope",
                fontSize: 20,
              }}
            >
              •••
            </span>
          </div>
        </div>

        <div
          style={{
            height: 430,
            flexShrink: 0,
            display: "flex",
            padding: "44px 52px 42px",
            borderBottom: "1px solid #eadbd2",
          }}
        >
          <div
            style={{
              width: 270,
              height: 330,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 42,
              background:
                "radial-gradient(circle at 50% 54%, #f7d6ce 0%, #f3e3dc 55%, #ead7cf 100%)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={packshotSrc}
              alt=""
              width={238}
              height={292}
              style={{
                width: 238,
                height: 292,
                objectFit: "contain",
              }}
            />
          </div>
          <div
            style={{
              minWidth: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingLeft: 42,
            }}
          >
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "2.6px",
                textTransform: "uppercase",
                color: "#9f5361",
              }}
            >
              {view.brand}
            </span>
            <span
              style={{
                marginTop: 14,
                fontFamily: "Manrope",
                fontSize: nameSize,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: "-1.8px",
              }}
            >
              {view.name}
            </span>
            <span
              style={{
                marginTop: 18,
                fontFamily: "Manrope",
                fontSize: 20,
                color: "#776764",
              }}
            >
              {view.size} · {view.storeCount}{" "}
              {view.storeCount === 1 ? "store" : "stores"}
            </span>
            <div
              style={{
                marginTop: 30,
                display: "flex",
                alignItems: "center",
                fontFamily: "Manrope",
                fontSize: 30,
                fontWeight: 600,
              }}
            >
              <CampaignAmount
                value={lowest}
                color="#251a18"
                fontSize={30}
                letterSpacing="-1px"
              />
              {view.offers.length > 1 ? (
                <>
                  <span style={{ margin: "0 11px", color: "#a38e88" }}>—</span>
                  <CampaignAmount
                    value={highest}
                    color="#251a18"
                    fontSize={30}
                    letterSpacing="-1px"
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "40px 52px 42px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 29,
                fontWeight: 600,
                letterSpacing: "-.8px",
              }}
            >
              Current listings
            </span>
            <span
              style={{
                fontFamily: "Manrope",
                fontSize: 17,
                color: "#8d7a75",
              }}
            >
              Observed {view.observedDate}
            </span>
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {view.offers.slice(0, 3).map((offer, index, offers) => {
              const label = offer.isLowest
                ? "Lowest observed"
                : offer.isTypical
                  ? "Typical observed"
                  : index === offers.length - 1 && offers.length > 1
                    ? "Highest observed"
                    : "Observed listing";
              return (
                <div
                  key={`${offer.retailer}-${offer.priceLabel}`}
                  style={{
                    minHeight: 130,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "25px 30px",
                    borderRadius: 30,
                    background: offer.isLowest ? "#2d201e" : "#f2e6df",
                    color: offer.isLowest ? "#fffaf4" : "#2d201e",
                  }}
                >
                  <div
                    style={{
                      maxWidth: 430,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Manrope",
                        fontSize: offer.retailer.length > 26 ? 21 : 24,
                        fontWeight: 600,
                        lineHeight: 1.1,
                      }}
                    >
                      {offer.retailer}
                    </span>
                    <span
                      style={{
                        marginTop: 9,
                        fontFamily: "Manrope",
                        fontSize: 15,
                        letterSpacing: "1.8px",
                        textTransform: "uppercase",
                        color: offer.isLowest
                          ? "rgba(255,250,244,.62)"
                          : "#937a74",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <CampaignAmount
                    value={offer.priceLabel}
                    color={offer.isLowest ? "#fffaf4" : "#2d201e"}
                    fontSize={33}
                    letterSpacing="-1.2px"
                  />
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "auto",
              height: 92,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "#f49bad",
              color: "#201113",
              fontFamily: "Manrope",
              fontSize: 25,
              fontWeight: 600,
            }}
          >
            Compare current prices&nbsp;&nbsp;→
          </div>
          <div
            style={{
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "Manrope",
              fontSize: 15,
              color: "#86736e",
            }}
          >
            <span>Exact Nigerian listings</span>
            <span>Prices change.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
