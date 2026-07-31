import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVERS, getServerBySlug } from "@/lib/servers/catalog";
import { MATRIX_CLIENTS, IDE_LABELS } from "@/lib/mcp/client-config";
import { JsonLd } from "@/components/seo/json-ld";
import {
  breadcrumbListSchema,
  faqPageSchema,
  softwareApplicationSchema,
  howToSchema,
} from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export function generateStaticParams() {
  return SERVERS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const server = getServerBySlug(slug);
  if (!server) return {};
  return {
    title: `${server.name} — install guide & tools`,
    description: `${server.tagline} ${server.description[0]?.slice(0, 140) ?? ""}`.trim(),
    alternates: { canonical: `/servers/${slug}` },
    openGraph: {
      title: `${server.name} — TwinMCP catalog`,
      description: server.tagline,
      url: `${SITE_URL}/servers/${slug}`,
      type: "article",
    },
  };
}

const KIND_LABELS = {
  official: "Official",
  community: "Community-maintained",
  "hosted-remote": "Hosted remote",
} as const;

const BLOG_TITLES: Record<string, string> = {
  "what-is-mcp": "What is Model Context Protocol?",
  "mcp-server-hosting": "MCP server hosting in 2026",
  "build-mcp-server": "How to build an MCP server",
  "cursor-mcp-setup": "Cursor MCP setup guide",
  "claude-desktop-mcp": "Claude Desktop MCP installation",
  "production-mcp-servers": "10 production-ready MCP servers",
  "secure-mcp-server": "Securing your MCP server",
  "mcp-server-monitoring": "MCP server monitoring",
  "notion-mcp-server-tutorial": "Build a Notion MCP server",
  "mcp-vs-langchain": "MCP vs LangChain Tools",
  "smithery-vs-twinmcp": "Smithery vs TwinMCP vs self-host",
  "upstash-box-vs-cloudflare-workers": "Upstash Box vs Cloudflare Workers",
};

export default async function ServerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const server = getServerBySlug(slug);
  if (!server) notFound();

  const related = server.relatedSlugs
    .map((s) => getServerBySlug(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const setupHowTo = howToSchema({
    name: `Install ${server.name}`,
    description: `Step-by-step installation of ${server.name} for AI coding agents (Cursor, Claude Desktop, Claude Code, Windsurf).`,
    steps: server.setupSteps.map((s, i) => ({
      name: `Step ${i + 1}`,
      text: s,
    })),
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "MCP servers", url: "/servers" },
            { name: server.name, url: `/servers/${server.slug}` },
          ]),
          softwareApplicationSchema({
            name: server.name,
            description: server.tagline,
          }),
          faqPageSchema(server.faq),
          setupHowTo,
        ]}
      />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={"/servers" as Route} className="hover:text-foreground">
                MCP servers
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="line-clamp-1 text-foreground">
              {server.name}
            </li>
          </ol>
        </nav>

        <header className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
              {KIND_LABELS[server.kind]}
            </span>
            <span className="text-muted-foreground">by {server.maintainer}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">{server.category}</span>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {server.name}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{server.tagline}</p>

          {server.warnings && server.warnings.length > 0 && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <strong className="font-semibold text-foreground">Notes:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {server.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* Description */}
        <section className="mb-12 space-y-5 text-base leading-7 text-foreground/90">
          {server.description.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {/* Tools */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">What the model can do</h2>
          <ul className="space-y-3">
            {server.tools.map((t) => (
              <li key={t.name} className="rounded-lg border border-border bg-card p-4">
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-sm text-foreground">
                  {t.name}
                </code>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Install */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">Install</h2>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Local (stdio) — Cursor / Claude Desktop
          </h3>
          <pre className="mb-6 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-4 text-sm">
            <code>{server.installStdio}</code>
          </pre>
          {server.installHttp ? (
            <>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Hosted (HTTP) — Claude Code / TwinMCP
              </h3>
              <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/40 p-4 text-sm">
                <code>{server.installHttp}</code>
              </pre>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This server is typically run as a stdio child process. To share it across a team or
              keep secrets server-side, deploy it on{" "}
              <Link
                href="/"
                className="font-medium underline underline-offset-4 hover:text-foreground"
              >
                TwinMCP
              </Link>{" "}
              and connect via HTTP.
            </p>
          )}
        </section>

        {/* Setup */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">Setup</h2>
          <ol className="space-y-3 text-base leading-7">
            {server.setupSteps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Connect to your AI client — internal links into the per-client matrix */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">
            Connect {server.name} to your AI client
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {MATRIX_CLIENTS.map((c) => (
              <Link
                key={c}
                href={`/servers/${server.slug}/${c}` as Route}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
              >
                <span className="text-foreground/90">
                  {server.name} with {IDE_LABELS[c]}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">What people use it for</h2>
          <ul className="space-y-3 text-base leading-7">
            {server.useCases.map((u, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <span className="text-foreground/90">{u}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">FAQ</h2>
          <dl className="space-y-5">
            {server.faq.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <dt className="text-base font-semibold tracking-tight">{item.q}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Source */}
        <section className="mb-12 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          <p>
            <strong className="font-semibold text-foreground">Package / source:</strong>{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">
              {server.packageOrImage}
            </code>
            {" — "}
            <a
              href={server.source}
              rel="noopener noreferrer"
              target="_blank"
              className="font-medium underline underline-offset-4 hover:text-foreground"
            >
              upstream repository ↗
            </a>
          </p>
        </section>

        {/* CTA */}
        <footer className="border-t border-border pt-10">
          <div className="rounded-2xl border border-border/80 bg-card p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Run {server.name} on TwinMCP in 2 minutes
            </h2>
            <p className="mt-3 text-muted-foreground">
              Isolated sandbox, encrypted secrets, one URL for Cursor / Claude / Windsurf. Free tier
              — no credit card.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={"/sign-up?plan=free" as Route}
                className="inline-flex items-center justify-center rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
              >
                Start free →
              </Link>
              <Link
                href={"/plans" as Route}
                className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
              >
                See pricing
              </Link>
            </div>
          </div>

          {/* Related blog posts */}
          {server.relatedBlogSlugs.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Related reading</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {server.relatedBlogSlugs.map((b) => (
                  <li key={b}>
                    <Link
                      href={`/blog/${b}` as Route}
                      className="group block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/40"
                    >
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Blog post
                      </p>
                      <h3 className="mt-2 text-base font-semibold leading-snug group-hover:underline">
                        {BLOG_TITLES[b] ?? b}
                      </h3>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related servers */}
          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Often paired with</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/servers/${r.slug}` as Route}
                      className="group block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/40"
                    >
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {r.category}
                      </p>
                      <h3 className="mt-2 text-base font-semibold leading-snug group-hover:underline">
                        {r.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.tagline}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </footer>
      </article>
    </>
  );
}
