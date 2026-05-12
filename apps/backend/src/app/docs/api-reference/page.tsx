import type { Metadata } from "next";
import { ApiReferenceClient } from "./api-reference-client";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "API Reference — TwinMCP",
  description:
    "Interactive OpenAPI reference for the TwinMCP control plane: create servers, install MCPs, manage API keys, and query usage.",
  alternates: { canonical: "/docs/api-reference" },
};

export default function ApiReferencePage() {
  return (
    <div className="min-h-screen">
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Docs", url: "/docs" },
          { name: "API Reference", url: "/docs/api-reference" },
        ])}
      />
      <ApiReferenceClient />
    </div>
  );
}
