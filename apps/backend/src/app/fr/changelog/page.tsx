import type { Metadata } from "next";
import { ChangelogView } from "@/components/marketing/changelog-view";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Nouveautés",
  description:
    "Ce qui a changé dans TwinMCP, mois par mois : nouveaux MCP, clés API limitées, tarifs, tableau de bord et corrections. Uniquement des fonctionnalités en ligne.",
  alternates: {
    canonical: "/fr/changelog",
    languages: { en: "/changelog", fr: "/fr/changelog", "x-default": "/changelog" },
  },
  openGraph: {
    title: "Nouveautés TwinMCP",
    description:
      "Les fonctionnalités et corrections en ligne sur TwinMCP, des plus récentes aux plus anciennes.",
    url: `${SITE_URL}/fr/changelog`,
    locale: "fr_FR",
  },
};

export default function FrChangelogPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Accueil", url: "/fr" },
          { name: "Nouveautés", url: "/fr/changelog" },
        ])}
      />
      <ChangelogView locale="fr" />
    </>
  );
}
