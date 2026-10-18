import type { Metadata, Route } from "next";
import Link from "next/link";
import { USE_CASES } from "@/lib/use-cases/registry";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";

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

      <div className="mx-auto max-w-5xl px-6 py-16">
        <nav
          aria-label="Breadcrumb"
          className="smallcaps tracking-sc mb-12 text-xs text-muted-foreground"
        >
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              Use cases
            </li>
          </ol>
        </nav>

        {/* The name engraved dead-centre on the card (DESIGN.md §4.2) */}
        <header className="pb-14 text-center md:pb-16">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            By host and by connector
          </p>
          <h1 className="display letterpress mt-6 text-5xl md:text-6xl lg:text-7xl">Use cases</h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            TwinMCP works with every major AI coding host and every popular MCP. Pick the shape that
            matches what you already use.
          </p>
        </header>

        {/* One sheet divided by hairlines, under the double rule */}
        <div className="rule-double pt-12 md:pt-16">
          <ul className="grid gap-px border border-border bg-border md:grid-cols-2">
            {USE_CASES.map((u) => (
              <li key={u.slug} className="bg-card">
                <Link
                  href={`/use-cases/${u.slug}` as Route}
                  className="group flex h-full flex-col p-7 transition-colors hover:bg-secondary/50"
                >
                  <p className="eyebrow">{u.heroEyebrow}</p>
                  <h2 className="smallcaps tracking-sc mt-3 text-2xl font-medium group-hover:text-brand">
                    {u.title}
                  </h2>
                  <p className="mt-3 text-base text-muted-foreground">{u.description}</p>
                  <span className="smallcaps tracking-sc mt-auto pt-6 text-xs text-muted-foreground group-hover:text-foreground">
                    Read the use case →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
