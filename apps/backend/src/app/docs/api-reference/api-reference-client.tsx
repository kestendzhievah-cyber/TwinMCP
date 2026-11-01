"use client";

import dynamic from "next/dynamic";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "next-themes";

// Scalar's renderer is large and client-only — load it lazily (no SSR) so the
// docs page paints immediately and the heavy JS streams in after.
const ApiReferenceReact = dynamic(
  () => import("@scalar/api-reference-react").then((m) => m.ApiReferenceReact),
  {
    ssr: false,
    loading: () => (
      <p className="px-4 py-8 text-sm text-muted-foreground sm:px-6">Loading API reference…</p>
    ),
  }
);

// Scalar ships its own theme; these variables pull it onto "Clear sky"
// (docs/DESIGN.md §2): white panels on the light-blue page, navy ink, brand
// blue for links and the selected sidebar item, rose for the one primary
// button, rounded corners. Hex constants mirror the tokens in globals.css,
// light and dark (the design-tokens guard exempts this file: no class names).
const CARD_CSS = `
.light-mode, .dark-mode {
  --scalar-font: var(--font-sans), Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  --scalar-font-code: var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  --scalar-radius: 8px; --scalar-radius-md: 8px; --scalar-radius-lg: 10px; --scalar-radius-xl: 12px;
}
.light-mode {
  --scalar-background-1: #FFFFFF; --scalar-background-2: #F3F8FF; --scalar-background-3: #E6F0FC;
  --scalar-color-1: #0B1F3A; --scalar-color-2: #3D5272; --scalar-color-3: #53688A;
  --scalar-color-accent: #1E4FC2; --scalar-background-accent: #1E4FC21A;
  --scalar-border-color: #D2DEEE;
  --scalar-button-1: #C2255C; --scalar-button-1-hover: #A61E4D; --scalar-button-1-color: #FFFFFF;
  --scalar-color-green: #0E7A4B; --scalar-color-yellow: #8A5A00;
  --scalar-color-blue: #1D62B5; --scalar-color-red: #B42318;
  --scalar-sidebar-color-active: #1E4FC2; --scalar-sidebar-item-active-background: #1E4FC21A;
}
.dark-mode {
  --scalar-background-1: #101D33; --scalar-background-2: #0A1424; --scalar-background-3: #13233D;
  --scalar-color-1: #E8EFFA; --scalar-color-2: #A6B6CF; --scalar-color-3: #8395B3;
  --scalar-color-accent: #8FB4FF; --scalar-background-accent: #8FB4FF1A;
  --scalar-border-color: #263A5C;
  --scalar-button-1: #F06A93; --scalar-button-1-hover: #FF85A8; --scalar-button-1-color: #1B0610;
  --scalar-color-green: #4ACB8E; --scalar-color-yellow: #F2B755;
  --scalar-color-blue: #7DB3F5; --scalar-color-red: #FF8A7A;
  --scalar-sidebar-color-active: #8FB4FF; --scalar-sidebar-item-active-background: #8FB4FF1A;
}
`;

export function ApiReferenceClient() {
  const { resolvedTheme } = useTheme();
  return (
    <ApiReferenceReact
      configuration={{
        url: "/api/openapi",
        theme: "default",
        customCss: CARD_CSS,
        darkMode: resolvedTheme === "dark",
        hideClientButton: false,
        authentication: {
          preferredSecurityScheme: "bearerAuth",
        },
      }}
    />
  );
}
