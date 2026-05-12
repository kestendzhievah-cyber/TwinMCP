import type { Metadata, Route } from "next";
import Link from "next/link";
import { USE_CASES } from "@/lib/use-cases/registry";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

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
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Use cases", url: "/use-cases" },
        ])}
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
              Use cases
            </li>
          </ol>
        </nav>

        <header className="mb-14">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Use cases</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            TwinMCP works with every major AI coding host and every popular MCP. Pick the shape that
            matches what you already use.
          </p>
        </header>

        <ul className="grid gap-5 md:grid-cols-2">
          {USE_CASES.map((u) => (
            <li key={u.slug}>
              <Link
                href={`/use-cases/${u.slug}` as Route}
                className="group block rounded-2xl border border-border bg-card p-7 transition-colors hover:border-foreground/40"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {u.heroEyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight group-hover:underline">
                  {u.title}
                </h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{u.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
