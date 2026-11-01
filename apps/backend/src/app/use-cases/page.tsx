import type { Metadata, Route } from "next";
import Link from "next/link";
import { USE_CASES } from "@/lib/use-cases/registry";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Use cases — TwinMCP",
  description:
    "TwinMCP use cases by AI host and by connector: Cursor MCP hosting, Claude MCP hosting, Notion MCP, GitHub MCP. Pick the integration that matches your stack.",
  alternates: { canonical: "/use-cases" },
  openGraph: {
    title: "TwinMCP use cases",
    description: "Use cases by AI host and connector — Cursor, Claude, Notion, GitHub.",
    url: `${SITE_URL}/use-cases`,
  },
};

// The host or connector each use case is about, keyed by use-case slug. Only
// marks in the brand-logo allow-list render; GitHub is retired, so it has none.
const LOGO_FOR: Record<string, string | undefined> = {
  "cursor-mcp-hosting": "cursor",
  "claude-mcp-hosting": "claude-desktop",
  "notion-mcp": "notion",
};

export default function UseCasesIndexPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Use cases", url: "/use-cases" },
          ]),
          itemListSchema(USE_CASES.map((u) => ({ name: u.title, url: `/use-cases/${u.slug}` }))),
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-20">
        <nav aria-label="Breadcrumb" className="mb-10 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-foreground">
              Use cases
            </li>
          </ol>
        </nav>

        <header className="max-w-2xl pb-10 md:pb-12">
          <p className="eyebrow">By host and by connector</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Use cases
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            TwinMCP works with every major AI coding host and every popular MCP. Pick the shape that
            matches what you already use.
          </p>
        </header>

        {/* One interactive card per use case, with the host or connector logo. */}
        <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
          {USE_CASES.map((u) => {
            const logo = LOGO_FOR[u.slug];
            return (
              <li key={u.slug}>
                <Link
                  href={`/use-cases/${u.slug}` as Route}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    {logo && hasBrandLogo(logo) ? (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card">
                        <BrandLogo slug={logo} size={22} decorative />
                      </span>
                    ) : null}
                    <p className="eyebrow">{u.heroEyebrow}</p>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold tracking-tight group-hover:text-brand sm:text-2xl">
                    {u.title}
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground">{u.description}</p>
                  <span className="mt-auto pt-6 text-sm font-medium text-brand">
                    Read the use case →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
