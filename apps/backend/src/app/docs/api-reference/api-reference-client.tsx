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
      <p className="px-4 py-8 text-sm italic text-muted-foreground sm:px-6">
        Loading API reference…
      </p>
    ),
  }
);

// Scalar ships its own theme; these variables pull it onto the card — bone
// surfaces, ink type, hairlines, square corners (docs/DESIGN.md).
const CARD_CSS = `
.light-mode, .dark-mode {
  --scalar-font: var(--font-serif), Garamond, Georgia, serif;
  --scalar-font-code: var(--font-mono), "Courier New", monospace;
  --scalar-radius: 0; --scalar-radius-lg: 0; --scalar-radius-xl: 0;
}
.light-mode {
  --scalar-background-1: #f9f6ef; --scalar-background-2: #f4f0e8; --scalar-background-3: #ebe5d9;
  --scalar-color-1: #2b2825; --scalar-color-2: #665f55; --scalar-color-3: #8a8275;
  --scalar-color-accent: #233048; --scalar-background-accent: #23304814;
  --scalar-border-color: #d8d1c3;
}
.dark-mode {
  --scalar-background-1: #1e1b17; --scalar-background-2: #171512; --scalar-background-3: #272320;
  --scalar-color-1: #e9e3d5; --scalar-color-2: #a39b8c; --scalar-color-3: #7d7668;
  --scalar-color-accent: #8fa3c9; --scalar-background-accent: #8fa3c914;
  --scalar-border-color: #35302a;
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
