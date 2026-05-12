"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "next-themes";

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
