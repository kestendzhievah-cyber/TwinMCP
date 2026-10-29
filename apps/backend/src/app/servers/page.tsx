import type { Metadata } from "next";
import { SERVERS } from "@/lib/servers/catalog";
import { SERVERS_PATHS } from "@/lib/i18n/locales";
import { COPY } from "./_components/copy";
import { ServersIndexView } from "./_components/index-view";
import { catalogueMetadata } from "./_components/metadata";

export const metadata: Metadata = catalogueMetadata({
  title: COPY.en.indexMetaTitle,
  description: COPY.en.indexMetaDescription(SERVERS.length),
  path: SERVERS_PATHS.en,
  languages: { en: SERVERS_PATHS.en, fr: SERVERS_PATHS.fr, "x-default": SERVERS_PATHS.en },
  locale: "en",
  type: "website",
});

export default function ServersIndexPage() {
  return <ServersIndexView locale="en" />;
}
