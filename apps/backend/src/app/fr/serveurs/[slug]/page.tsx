import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildServerPage,
  relatedServers,
  resolveServerParams,
  serverPageParams,
} from "@/lib/seo/server-pages";
import { ServerPageView } from "@/app/servers/_components/server-page-view";
import { catalogueMetadata } from "@/app/servers/_components/metadata";

// French twin of app/servers/[slug]: one page per installable catalogue MCP.
// Unknown, retired and internal slugs are not generated and 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return serverPageParams();
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const entry = resolveServerParams(slug);
  if (!entry) return {};
  const data = buildServerPage(entry, "fr");
  return catalogueMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    languages: data.languages,
    locale: "fr",
  });
}

export default async function ServeurPage({ params }: { params: Params }) {
  const { slug } = await params;
  const entry = resolveServerParams(slug);
  if (!entry) notFound();
  return <ServerPageView data={buildServerPage(entry, "fr")} related={relatedServers(entry)} />;
}
