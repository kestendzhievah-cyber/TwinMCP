import type { Metadata, Route } from "next";
import Link from "next/link";
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
      {/* The card's top line: a small-caps breadcrumb on one hairline, above the
          Scalar renderer (which draws its own chrome below). */}
      <nav
        aria-label="Breadcrumb"
        className="smallcaps tracking-sc border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-6"
      >
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>·</li>
          <li>
            <Link href={"/docs" as Route} className="hover:text-foreground">
              Docs
            </Link>
          </li>
          <li aria-hidden>·</li>
          <li aria-current="page" className="text-foreground">
            API Reference
          </li>
        </ol>
      </nav>
      <ApiReferenceClient />
    </div>
  );
}
