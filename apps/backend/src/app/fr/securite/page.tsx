import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { SECURITY_PATHS, SecurityContent } from "@/components/marketing/security-content";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const PATH = SECURITY_PATHS.fr;

const TITLE = "Sécurité & RGPD";
const DESCRIPTION =
  "Comment TwinMCP protège vos serveurs MCP, vos clés API et vos données : secrets chiffrés en AES-256-GCM, une Upstash Box isolée par serveur, clés API hachées et limitables, journal d’audit, suppression du compte, sous-traitants. Aucune certification revendiquée.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: { en: SECURITY_PATHS.en, fr: PATH, "x-default": SECURITY_PATHS.en },
  },
  openGraph: {
    type: "website",
    siteName: "TwinMCP",
    url: `${SITE_URL}${PATH}`,
    title: `TwinMCP — ${TITLE}`,
    description: DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: { card: "summary_large_image", title: `TwinMCP — ${TITLE}`, description: DESCRIPTION },
};

export default function SecuritePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Accueil", url: "/fr" },
          { name: "Sécurité & RGPD", url: PATH },
        ])}
      />
      <SecurityContent locale="fr" />
    </>
  );
}
