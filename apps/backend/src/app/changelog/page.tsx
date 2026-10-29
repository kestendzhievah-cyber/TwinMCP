import type { Metadata } from "next";
import { ChangelogView } from "@/components/marketing/changelog-view";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What shipped in TwinMCP, month by month: new MCPs, scoped API keys, pricing, dashboard and reliability fixes. Live features only.",
  alternates: {
    canonical: "/changelog",
    languages: { en: "/changelog", fr: "/fr/changelog", "x-default": "/changelog" },
  },
  openGraph: {
    title: "TwinMCP changelog",
    description: "Features and fixes that are live in TwinMCP, newest first.",
    url: `${SITE_URL}/changelog`,
  },
};

export default function ChangelogPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Changelog", url: "/changelog" },
        ])}
      />
      <ChangelogView />
    </>
  );
}
