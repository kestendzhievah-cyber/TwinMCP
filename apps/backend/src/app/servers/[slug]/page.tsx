import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildServerPage,
  relatedServers,
  resolveServerParams,
  serverPageParams,
} from "@/lib/seo/server-pages";
import { ServerPageView } from "../_components/server-page-view";
import { catalogueMetadata } from "../_components/metadata";

// One page per installable catalogue MCP (lib/servers/catalog.ts, read from the
// seed). Unknown, retired and internal slugs are not generated and 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return serverPageParams();
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const entry = resolveServerParams(slug);
  if (!entry) return {};
  const data = buildServerPage(entry, "en");
  return catalogueMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    languages: data.languages,
    locale: "en",
  });
}

export default async function ServerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const entry = resolveServerParams(slug);
  if (!entry) notFound();
  return <ServerPageView data={buildServerPage(entry, "en")} related={relatedServers(entry)} />;
}
