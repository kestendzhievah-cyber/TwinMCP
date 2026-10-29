import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildClientPage,
  clientPageParams,
  isClientGuideIndexed,
  relatedServers,
  resolveClientParams,
} from "@/lib/seo/server-pages";
import { ClientPageView } from "@/app/servers/_components/client-page-view";
import { catalogueMetadata } from "@/app/servers/_components/metadata";

// French per-client guides: only for FR_SERVER_CLIENT_GUIDE_SLUGS (lib/i18n/locales.ts),
// so the long tail stays English-only. Other slugs and unknown clients 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return clientPageParams("fr");
}

type Params = Promise<{ slug: string; client: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, client } = await params;
  const resolved = resolveClientParams(slug, client, "fr");
  if (!resolved) return {};
  const data = buildClientPage(resolved.entry, resolved.client, "fr");
  return catalogueMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    languages: data.languages,
    locale: "fr",
    indexable: isClientGuideIndexed(slug),
  });
}

export default async function ServeurClientPage({ params }: { params: Params }) {
  const { slug, client } = await params;
  const resolved = resolveClientParams(slug, client, "fr");
  if (!resolved) notFound();
  return (
    <ClientPageView
      data={buildClientPage(resolved.entry, resolved.client, "fr")}
      related={relatedServers(resolved.entry)}
    />
  );
}
