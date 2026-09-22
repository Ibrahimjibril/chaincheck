import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CHAINCHECK — Onchain claims. Verified by evidence.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090b",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 6,
            color: "#3ee8b5",
            marginBottom: 28,
            display: "flex",
          }}
        >
          ONCHAIN CLAIMS. VERIFIED BY EVIDENCE.
        </div>
        <div style={{ fontSize: 128, fontWeight: 800, display: "flex" }}>
          <span style={{ display: "flex" }}>CHAIN</span>
          <span style={{ color: "#3ee8b5", display: "flex" }}>CHECK</span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#9ca3af",
            marginTop: 28,
            display: "flex",
          }}
        >
          Powered by real Nansen Smart Money data
        </div>
      </div>
    ),
    { ...size }
  );
}
