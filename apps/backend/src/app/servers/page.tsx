import type { Metadata, Route } from "next";
import Link from "next/link";
import { SERVERS, getServersByCategory } from "@/lib/servers/catalog";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

export const metadata: Metadata = {
  title: "MCP server catalog — TwinMCP",
  description:
    "Curated catalog of Model Context Protocol servers worth running in production: GitHub, Notion, Linear, Postgres, Filesystem, Slack, Brave Search, Sentry, and more. Install snippets for Cursor, Claude Desktop, and Claude Code.",
  alternates: { canonical: "/servers" },
  openGraph: {
    title: "TwinMCP — MCP server catalog",
    description:
      "Curated MCP servers worth installing in production, with copy-paste config for every major AI host.",
    url: `${SITE_URL}/servers`,
  },
};

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "TwinMCP — MCP server catalog",
  url: `${SITE_URL}/servers`,
  description: "Curated catalog of maintained Model Context Protocol servers for AI coding agents.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  hasPart: SERVERS.map((s) => ({
    "@type": "SoftwareApplication",
    name: s.name,
    url: `${SITE_URL}/servers/${s.slug}`,
    applicationCategory: "DeveloperApplication",
    description: s.tagline,
  })),
};

const KIND_LABELS = {
  official: "Official",
  community: "Community",
  "hosted-remote": "Hosted remote",
} as const;

export default function ServersIndexPage() {
  const grouped = getServersByCategory();
  const categories = Object.keys(grouped).sort();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "MCP servers", url: "/servers" },
          ]),
          collectionSchema,
        ]}
      />

      <div className="mx-auto max-w-5xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              MCP servers
            </li>
          </ol>
        </nav>

        <header className="mb-14">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            MCP server catalog
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Curated Model Context Protocol servers worth running in production — maintained
            packages, real tool lists, copy-paste config for every major AI host. Updated as the
            ecosystem evolves.
          </p>
        </header>

        {categories.map((cat) => (
          <section key={cat} className="mb-14">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {cat}
            </h2>
            <ul className="grid gap-5 md:grid-cols-2">
              {grouped[cat].map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/servers/${s.slug}` as Route}
                    className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/40"
                  >
                    <div className="mb-3 flex items-center gap-2 text-xs">
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                        {KIND_LABELS[s.kind]}
                      </span>
                      <span className="text-muted-foreground">by {s.maintainer}</span>
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight group-hover:underline">
                      {s.name}
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{s.tagline}</p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {s.tools.length} tool{s.tools.length === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-16 rounded-2xl border border-border bg-card p-8 text-center md:p-10">
          <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Run any of these MCPs on TwinMCP in two minutes
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free tier covers one server and the full catalog. No credit card.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Start free →
            </Link>
            <Link
              href={"/blog/production-mcp-servers" as Route}
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Read the production guide
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
