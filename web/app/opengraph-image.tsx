import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dryline — Investigate Texas water at any address.";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#eef2f3",
          color: "#07171f",
          fontFamily: "Georgia, serif",
          padding: "72px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dryline mark — large, top-left */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <line
              x1="5"
              y1="25"
              x2="27"
              y2="7"
              stroke="#07171f"
              strokeWidth="2.4"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
            <circle cx="5" cy="25" r="3.5" fill="#0d3b6f" />
            <circle cx="27" cy="7" r="3.5" fill="#b58a52" stroke="#7a5a2c" strokeWidth="1" />
          </svg>
          <span style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.012em" }}>
            Dryline
          </span>
        </div>

        {/* Hook */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 80,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontWeight: 400,
              color: "#07171f",
              textWrap: "balance",
              maxWidth: 1040,
              display: "flex",
            }}
          >
            Texas added 4 million people in five years.
          </div>
          <div
            style={{
              fontSize: 80,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontStyle: "italic",
              color: "#4a6c78",
              display: "flex",
            }}
          >
            Our water didn&apos;t keep up.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#4a6c78",
            fontFamily: "monospace",
            fontSize: 18,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span>Investigate Texas water at any address.</span>
          <span>github.com/willhines90/dryline</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
