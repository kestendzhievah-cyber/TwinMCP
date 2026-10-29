import type { Metadata } from "next";
import { SERVERS } from "@/lib/servers/catalog";
import { SERVERS_PATHS } from "@/lib/i18n/locales";
import { COPY } from "@/app/servers/_components/copy";
import { ServersIndexView } from "@/app/servers/_components/index-view";
import { catalogueMetadata } from "@/app/servers/_components/metadata";

export const metadata: Metadata = catalogueMetadata({
  title: COPY.fr.indexMetaTitle,
  description: COPY.fr.indexMetaDescription(SERVERS.length),
  path: SERVERS_PATHS.fr,
  languages: { en: SERVERS_PATHS.en, fr: SERVERS_PATHS.fr, "x-default": SERVERS_PATHS.en },
  locale: "fr",
  type: "website",
});

export default function ServeursIndexPage() {
  return <ServersIndexView locale="fr" />;
}
