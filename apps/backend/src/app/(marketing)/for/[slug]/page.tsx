import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { trackPageServed } from "@/lib/analytics/server";
import { ABM_PAGES } from "@/lib/abm/pages";

// Private per-prospect pitch pages (see lib/abm/pages.ts): noindex, absent
// from the sitemap and the nav — the URL only travels inside outreach emails.

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = ABM_PAGES[slug];
  if (!page) return {};
  return {
    title: `TwinMCP for ${page.prospect}`,
    description: page.lead,
    robots: { index: false, follow: false },
  };
}

const SNIPPET = `{
  "mcpServers": {
    "twinmcp": {
      "url": "https://twinmcp.fr/api/mcp/<your-server>/<mcp>",
      "headers": { "Authorization": "Bearer ctx7sk_…" }
    }
  }
}`;

export default async function AbmPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const page = ABM_PAGES[slug];
  if (!page) notFound();

  // Cookieless server-side page view — an open shows up without any banner.
  trackPageServed({
    path: `/for/${page.slug}`,
    locale: "en",
    searchParams: await searchParams,
    headers: await headers(),
  });

  const utm = `?utm_source=${page.slug}&utm_medium=abm`;

  return (
    <>
      {/* Hero */}
      <section className="bg-background">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-14 pt-12 text-center sm:px-6 md:pb-20 md:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Prepared for {page.prospect}
          </p>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {page.title}
            <span className="text-primary">{page.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{page.lead}</p>
          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link href={`/sign-up${utm}` as Route}>Create a free server</Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href={`/demo${utm}` as Route}>Book a 20-min walkthrough</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Use cases mapped to their services */}
      <Section
        eyebrow="Where it plugs in"
        title="Built around the work your team already does"
        tone="alt"
        bordered
      >
        <ul className="grid gap-4 sm:grid-cols-2 md:gap-6">
          {page.useCases.map((u) => (
            <li
              key={u.title}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
            >
              <h3 className="font-display text-lg font-semibold tracking-tight">{u.title}</h3>
              <p className="flex-1 text-sm text-muted-foreground">{u.body}</p>
              <p className="flex flex-wrap gap-2">
                {u.mcps.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {m}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Try it */}
      <Section
        eyebrow="Try it"
        title="Two minutes, nothing to install"
        description="Any MCP client works — Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline, Zed."
      >
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2 md:items-center">
          <ol className="list-decimal space-y-3 pl-6 text-base leading-relaxed">
            <li>Open your MCP client's config and paste the snippet.</li>
            <li>Replace the URL and key with your sandbox credentials.</li>
            <li>
              Restart the client and ask it something real — the examples below are a good start.
            </li>
          </ol>
          <CodeSnippet code={SNIPPET} language="json" filename="mcp.json" />
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          {page.sandboxNote}
        </p>
      </Section>

      {/* Example asks */}
      <Section eyebrow="In practice" title="What your analysts would ask" tone="alt" bordered>
        <ul className="mx-auto flex max-w-3xl flex-col gap-3">
          {page.asks.map((a) => (
            <li
              key={a}
              className="rounded-2xl border border-border bg-card px-5 py-4 text-sm leading-relaxed shadow-sm"
            >
              <span aria-hidden className="mr-2 select-none text-muted-foreground">
                ›
              </span>
              {a}
            </li>
          ))}
        </ul>
      </Section>

      {/* CTA band */}
      <section data-sticky-cta-hide className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-3xl bg-surface-band p-8 text-center md:p-14">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              One URL and one key per client, for the whole agency
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Start self-serve, or let us set up your first client workspace with you. Agencies can
              also join the partner program — white-label and revenue share.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="xl" className="w-full sm:w-auto">
                <Link href={`/sign-up${utm}` as Route}>Create a free server</Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
                <Link href={`/demo${utm}` as Route}>Book a 20-min walkthrough</Link>
              </Button>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            This page was prepared for {page.prospect} by TwinMCP. It is not indexed and not linked
            from the public site.
          </p>
        </div>
      </section>
    </>
  );
}
