import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { SECURITY_PATHS, SecurityContent } from "@/components/marketing/security-content";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = SECURITY_PATHS.en;

const TITLE = "Security & GDPR";
const DESCRIPTION =
  "How TwinMCP protects your MCP servers, API keys and data: AES-256-GCM encrypted secrets, one isolated Upstash Box per server, hashed and scoped API keys, audit log, account deletion, sub-processors. No certification claims.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: PATH, fr: SECURITY_PATHS.fr, "x-default": PATH },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: `TwinMCP — ${TITLE}`,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: `TwinMCP — ${TITLE}`, description: DESCRIPTION },
};

export default function SecurityPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Security & GDPR", url: PATH },
        ])}
      />
      <SecurityContent locale="en" />
    </>
  );
}
