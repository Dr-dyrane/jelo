export function JeloCareMark() {
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

export function CampaignAmount({
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
