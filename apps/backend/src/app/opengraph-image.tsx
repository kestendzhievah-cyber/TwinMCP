import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TwinMCP — Managed MCP runtimes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The social card is literally the business card (docs/DESIGN.md §5): bone
// stock, a hairline frame, the name engraved in letterspaced capitals, and one
// address line of real facts. Satori has no small caps, so capitals + tracking.
const BONE = "#f4f0e8";
const CARD = "#f9f6ef";
const INK = "#2b2825";
const MUTED = "#665f55";
const RULE = "#d8d1c3";

// In production the bundler hands back an absolute URL for the traced asset;
// in dev it is root-relative (/_next/static/media/…), so anchor it on the
// site origin before fetching.
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
function font(url: URL): Promise<ArrayBuffer> {
  const href = String(url);
  const abs = href.startsWith("/") ? new URL(href, BASE) : url;
  return fetch(abs).then((r) => r.arrayBuffer());
}
const garamond = font(new URL("./fonts/EBGaramond-Medium.ttf", import.meta.url));
const courier = font(new URL("./fonts/CourierPrime-Regular.ttf", import.meta.url));

export default async function OpengraphImage() {
  const [garamondData, courierData] = await Promise.all([garamond, courier]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BONE,
          padding: 36,
          fontFamily: "Garamond",
          color: INK,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: CARD,
            border: `1px solid ${RULE}`,
            padding: "40px 56px 36px",
          }}
        >
          {/* top line: tagline left, site right */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "Courier",
              fontSize: 20,
              letterSpacing: 4,
              color: MUTED,
            }}
          >
            <span>MANAGED MCP RUNTIMES</span>
            <span>twinmcp.fr</span>
          </div>

          {/* the engraved name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 132, letterSpacing: 14, lineHeight: 1 }}>TWINMCP</div>
            <div
              style={{
                display: "flex",
                width: 72,
                height: 2,
                background: RULE,
                marginTop: 34,
                marginBottom: 34,
              }}
            />
            <div style={{ fontSize: 40, color: MUTED, lineHeight: 1.2, maxWidth: 900 }}>
              Run your MCP servers without managing infra.
            </div>
          </div>

          {/* address line */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: `1px solid ${RULE}`,
              paddingTop: 22,
              fontFamily: "Courier",
              fontSize: 19,
              letterSpacing: 3,
              color: MUTED,
            }}
          >
            <span>CURSOR · CLAUDE CODE · WINDSURF · CLINE</span>
            <span>HELLO@TWINMCP.FR</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Garamond", data: garamondData, weight: 500, style: "normal" },
        { name: "Courier", data: courierData, weight: 400, style: "normal" },
      ],
    }
  );
}
