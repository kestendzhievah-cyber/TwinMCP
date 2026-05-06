import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TwinMCP API · Reference",
  description: "OpenAPI reference for the TwinMCP control plane API",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
