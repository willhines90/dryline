import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dryline — Follow the water at any Texas address — every claim cited.";

// Edge-safe ArrayBuffer → base64 (no Node Buffer in the edge runtime).
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export default async function OpengraphImage() {
  // Brand wordmark (the slate D mark + "Dryline" set in Lato), colocated so
  // Next bundles it for the edge runtime via the import.meta.url pattern.
  // We embed the rasterized lockup rather than render the mark's SVG inline
  // because Satori (next/og) has incomplete clipPath / fill-rule support and
  // the mark's wave-band negative space relies on both.
  const wordmark = await fetch(
    new URL("./og-wordmark.png", import.meta.url),
  ).then((r) => r.arrayBuffer());
  const wordmarkSrc = `data:image/png;base64,${toBase64(wordmark)}`;

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
        {/* Brand wordmark — top-left */}
        <img src={wordmarkSrc} width={237} height={64} alt="Dryline" />

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
            Texas added 2.6 million people in five years.
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
          <span>Follow the water at any Texas address.</span>
          <span>github.com/willhines90/dryline</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
