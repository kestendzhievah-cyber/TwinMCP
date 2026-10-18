import type { Metadata, Route } from "next";
import Link from "next/link";
import { SERVERS, getServersByCategory } from "@/lib/servers/catalog";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

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

// Kind → badge tint. The catalog lists many official servers, so the brass
// "Official" seal (one per view, DESIGN.md §4.8) is reserved for the detail page;
// here official is the ink-hairline stamp.
const KIND_BADGE = {
  official: "outline",
  community: "secondary",
  "hosted-remote": "info",
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
          itemListSchema(SERVERS.map((s) => ({ name: s.name, url: `/servers/${s.slug}` }))),
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
        <nav
          aria-label="Breadcrumb"
          className="smallcaps tracking-sc mb-12 text-xs text-muted-foreground"
        >
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              MCP servers
            </li>
          </ol>
        </nav>

        {/* The centred name (DESIGN.md §4.2): eyebrow with rules, engraved h1,
            short hairline, lead, then one small-caps address line of facts. */}
        <header className="pb-14 text-center md:pb-16">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            Model Context Protocol
          </p>
          <h1 className="display letterpress mt-6 text-5xl md:text-6xl lg:text-7xl">
            MCP server catalog
          </h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Curated Model Context Protocol servers worth running in production — maintained
            packages, real tool lists, copy-paste config for every major AI host. Updated as the
            ecosystem evolves.
          </p>
          <p className="smallcaps tracking-sc lining mt-8 text-xs text-muted-foreground">
            {SERVERS.length} servers · {categories.length} categories · Copy-paste config for every
            major AI host
          </p>
        </header>

        <div className="rule-double space-y-16 pt-14">
          {categories.map((cat) => (
            <section key={cat}>
              <div className="mb-6 flex items-center gap-4">
                <h2 className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                  {cat}
                </h2>
                <span aria-hidden className="h-px flex-1 bg-border" />
                <span className="smallcaps tracking-sc lining text-xs text-muted-foreground">
                  {grouped[cat].length} server{grouped[cat].length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="grid gap-5 md:grid-cols-2">
                {grouped[cat].map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/servers/${s.slug}` as Route}
                      className="group flex h-full flex-col border border-border bg-card p-6 transition-colors hover:border-foreground/60"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Badge variant={KIND_BADGE[s.kind]}>{KIND_LABELS[s.kind]}</Badge>
                        <span className="smallcaps tracking-sc text-xs text-muted-foreground">
                          by {s.maintainer}
                        </span>
                      </div>
                      <h3 className="smallcaps tracking-sc mt-4 text-xl font-medium group-hover:underline group-hover:decoration-brand group-hover:underline-offset-[6px]">
                        {s.name}
                      </h3>
                      <p className="mt-2 text-base text-muted-foreground">{s.tagline}</p>
                      <p className="smallcaps tracking-sc lining mt-auto flex items-center gap-3 pt-5 text-xs text-muted-foreground">
                        <span>
                          {s.tools.length} tool{s.tools.length === 1 ? "" : "s"}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="transition-colors group-hover:text-foreground">
                          Install guide →
                        </span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="rule-double mt-20 pt-14">
          <div className="border border-foreground/70 bg-card px-6 py-12 text-center md:px-10">
            <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
              Managed MCP Runtimes
            </p>
            <h2 className="mt-6 text-3xl font-medium md:text-4xl">
              Run any of these MCPs on TwinMCP in two minutes
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Free tier covers one server and the full catalog. No credit card.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>Start free →</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={"/blog/production-mcp-servers" as Route}>
                  Read the production guide
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
