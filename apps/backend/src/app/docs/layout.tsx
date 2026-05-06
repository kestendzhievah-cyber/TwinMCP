import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description: "OpenAPI reference for the TwinMCP control plane API.",
  alternates: { canonical: "/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
