import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TwinMCP — Run your MCP servers without managing infra";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Halo gradient — top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "#fafafa",
              color: "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            T
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>TwinMCP</span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 4,
              color: "#a1a1aa",
              margin: 0,
            }}
          >
            MCPs as a Service
          </p>
          <h1
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              margin: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span>Run your MCP servers</span>
            <span
              style={{
                background: "linear-gradient(90deg, #a78bfa 0%, #60a5fa 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              without managing infra.
            </span>
          </h1>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#a1a1aa",
            borderTop: "1px solid rgba(250,250,250,0.1)",
            paddingTop: 28,
          }}
        >
          <span style={{ display: "flex", gap: 28 }}>
            <span>Cursor</span>
            <span>·</span>
            <span>Claude Code</span>
            <span>·</span>
            <span>Windsurf</span>
            <span>·</span>
            <span>Cline</span>
          </span>
          <span style={{ color: "#fafafa" }}>twinmcp.fr</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
