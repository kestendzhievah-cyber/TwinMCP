import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildClientPage,
  clientPageParams,
  isClientGuideIndexed,
  relatedServers,
  resolveClientParams,
} from "@/lib/seo/server-pages";
import { ClientPageView } from "../../_components/client-page-view";
import { catalogueMetadata } from "../../_components/metadata";

// One page per (catalogue MCP × named client): "Use the <MCP> MCP server in
// <Client>". All static; unknown MCPs or clients 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return clientPageParams("en");
}

type Params = Promise<{ slug: string; client: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, client } = await params;
  const resolved = resolveClientParams(slug, client, "en");
  if (!resolved) return {};
  const data = buildClientPage(resolved.entry, resolved.client, "en");
  return catalogueMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    languages: data.languages,
    locale: "en",
    indexable: isClientGuideIndexed(slug),
  });
}

export default async function ServerClientPage({ params }: { params: Params }) {
  const { slug, client } = await params;
  const resolved = resolveClientParams(slug, client, "en");
  if (!resolved) notFound();
  return (
    <ClientPageView
      data={buildClientPage(resolved.entry, resolved.client, "en")}
      related={relatedServers(resolved.entry)}
    />
  );
}
