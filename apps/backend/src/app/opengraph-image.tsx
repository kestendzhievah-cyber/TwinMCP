import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBrandLogo } from "@/components/brand/brand-logo";
import { walletFacts } from "@/components/pricing/wallet-copy";

// Node runtime on purpose: the card has no dynamic input, so Next pre-renders
// it once at build time, when src/app/fonts is on disk (no network fetch, and
// nothing to read at request time in the standalone image).

// Every figure comes from the wallet facts (docs/DESIGN.md "Copy rules").
const FACTS = walletFacts("en");

export const alt = `TwinMCP: host any MCP server. Start with ${FACTS.signupCredit} free.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// "Clear sky" (docs/DESIGN.md, spec §2.1): a white card on the light-blue page,
// navy ink, one rose figure, the offer pill, and the clients it works with.
// Hex constants, not tokens: Satori renders outside the CSS (the design-tokens
// guard exempts this file).
const PAGE = "#F3F8FF";
const CARD = "#FFFFFF";
const INK = "#0B1F3A";
const MUTED = "#3D5272";
const RULE = "#D2DEEE";
const BRAND = "#1E4FC2";
const PRIMARY = "#C2255C";
const OFFER = "#FFE8EE";
const OFFER_INK = "#8A1538";
const OFFER_BORDER = "#F3A6BA";

// Satori has no font fallback chain of its own: these names are the two static
// OFL faces in src/app/fonts (Inter SemiBold, Plus Jakarta Sans ExtraBold).
const SANS = "Inter";
const DISPLAY = "Plus Jakarta Sans";

type CardFont = { name: string; data: ArrayBuffer; weight: 600 | 800; style: "normal" };

// Missing or unreadable fonts must never break the build: fall back to the
// renderer's default face rather than throwing.
async function loadFonts(): Promise<CardFont[]> {
  const dir = join(process.cwd(), "src", "app", "fonts");
  try {
    const [inter, jakarta] = await Promise.all([
      readFile(join(dir, "Inter-SemiBold.ttf")),
      readFile(join(dir, "PlusJakartaSans-ExtraBold.ttf")),
    ]);
    const buf = (b: Buffer) =>
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    return [
      { name: SANS, data: buf(inter), weight: 600, style: "normal" },
      { name: DISPLAY, data: buf(jakarta), weight: 800, style: "normal" },
    ];
  } catch {
    return [];
  }
}

// "Works with" row: unmodified marks with their names (spec §7.3). VS Code is
// text only (no Microsoft icon); black-only marks take the ink colour.
const CLIENTS: { key: string | null; label: string }[] = [
  { key: "cursor", label: "Cursor" },
  { key: "claude-code", label: "Claude Code" },
  { key: null, label: "VS Code" },
  { key: "windsurf", label: "Windsurf" },
  { key: "cline", label: "Cline" },
  { key: "zed", label: "Zed" },
];

function ClientMark({ slug }: { slug: string }) {
  const def = getBrandLogo(slug);
  if (!def) return null;
  return (
    <svg width={28} height={28} viewBox="0 0 24 24">
      <path d={def.path} fill={def.hex ? `#${def.hex}` : INK} />
    </svg>
  );
}

// The TwinMCP mark (spec §4.13, as drawn by components/marketing/logo.tsx):
// a navy rounded square, a white "T", a rose dot ringed in the card colour.
function Mark({ size: s }: { size: number }) {
  const k = s / 28;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: s,
        height: s,
        borderRadius: 10 * k,
        background: INK,
        color: CARD,
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: 14 * k,
        lineHeight: 1,
      }}
    >
      T
      <div
        style={{
          position: "absolute",
          top: -4 * k,
          right: -4 * k,
          width: 10 * k,
          height: 10 * k,
          borderRadius: 9999,
          background: PRIMARY,
          border: `${2 * k}px solid ${CARD}`,
        }}
      />
    </div>
  );
}

export default async function OpengraphImage() {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PAGE,
          padding: 40,
          fontFamily: SANS,
          fontWeight: 600,
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
            borderRadius: 24,
            boxShadow: "0 24px 48px -12px rgba(11, 31, 58, 0.16)",
            padding: "40px 56px 36px",
          }}
        >
          {/* top line: logo left, site right */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Mark size={52} />
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: 34,
                  letterSpacing: "-0.025em",
                }}
              >
                TwinMCP
              </div>
            </div>
            <div style={{ fontSize: 22, color: MUTED }}>twinmcp.fr</div>
          </div>

          {/* offer pill, headline, lead */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 18px",
                borderRadius: 9999,
                border: `2px solid ${OFFER_BORDER}`,
                background: OFFER,
                color: OFFER_INK,
                fontSize: 22,
              }}
            >
              {`${FACTS.signupCredit} free credit · no card`}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 22,
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: 72,
                lineHeight: 1.05,
                letterSpacing: "-0.025em",
              }}
            >
              <div>Host any MCP server.</div>
              <div style={{ display: "flex" }}>
                Start with&nbsp;
                <span style={{ color: PRIMARY }}>
                  {`${FACTS.signupCredit} free`}
                  {/* Satori breaks the run between spans and leaves a gap
                      before the full stop; pull it back to the word. */}
                  <span style={{ color: INK, marginLeft: "-0.12em" }}>.</span>
                </span>
              </div>
            </div>
            <div
              style={{ marginTop: 22, fontSize: 26, lineHeight: 1.35, color: MUTED, maxWidth: 960 }}
            >
              70+ ready-to-run MCPs, each in its own isolated sandbox behind one URL.
            </div>
          </div>

          {/* works with */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              borderTop: `1px solid ${RULE}`,
              paddingTop: 22,
              fontSize: 20,
            }}
          >
            <div
              style={{
                fontSize: 15,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: BRAND,
              }}
            >
              Works with
            </div>
            {CLIENTS.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {c.key && <ClientMark slug={c.key} />}
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    }
  );
}
