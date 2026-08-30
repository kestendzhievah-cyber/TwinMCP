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
    loading: () => <div className="p-8 text-sm text-muted-foreground">Loading API reference…</div>,
  }
);

export function ApiReferenceClient() {
  const { resolvedTheme } = useTheme();
  return (
    <ApiReferenceReact
      configuration={{
        url: "/api/openapi",
        theme: "default",
        darkMode: resolvedTheme === "dark",
        hideClientButton: false,
        authentication: {
          preferredSecurityScheme: "bearerAuth",
        },
      }}
    />
  );
}
