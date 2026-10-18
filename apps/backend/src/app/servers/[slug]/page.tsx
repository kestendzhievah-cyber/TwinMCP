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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

// Kind → badge tint. "Official" is the one brass seal on this view
// (DESIGN.md §4.8); the other kinds are plain stamps.
const KIND_BADGE = {
  official: "gilt",
  community: "secondary",
  "hosted-remote": "info",
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

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
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
            <li>
              <Link href={"/servers" as Route} className="transition-colors hover:text-foreground">
                MCP servers
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="line-clamp-1 text-foreground">
              {server.name}
            </li>
          </ol>
        </nav>

        {/* The card itself: category as the eyebrow line, the name engraved in
            the centre, one address line of facts underneath. */}
        <header className="pb-10 text-center">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            {server.category}
          </p>
          <h1 className="display letterpress mt-6 text-4xl sm:text-5xl md:text-6xl">
            {server.name}
          </h1>
          <div className="mx-auto mt-7 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {server.tagline}
          </p>
          <div className="smallcaps tracking-sc lining mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <Badge variant={KIND_BADGE[server.kind]}>{KIND_LABELS[server.kind]}</Badge>
            <span aria-hidden>·</span>
            <span>by {server.maintainer}</span>
            <span aria-hidden>·</span>
            <span>
              {server.tools.length} tool{server.tools.length === 1 ? "" : "s"}
            </span>
          </div>

          {server.warnings && server.warnings.length > 0 && (
            <div className="mt-8 border border-warning/40 border-l-2 border-l-warning bg-warning/10 p-4 text-left text-sm">
              <strong className="smallcaps tracking-sc font-medium text-warning">Notes:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">
                {server.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </header>
        <Separator variant="double" />

        {/* Description */}
        <section className="mt-10 space-y-5 text-lg leading-8 text-foreground/90">
          {server.description.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {/* Tools — a ledger: small-caps header on a firmer rule, hairline rows, mono names */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">What the model can do</h2>
          <Table className="border-b border-border">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Tool</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {server.tools.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="align-top">
                    <code className="font-mono text-sm text-foreground">{t.name}</code>
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">{t.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {/* Install — typewriter blocks with a small-caps filename tab */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">Install</h2>
          <div className="border border-border bg-secondary/60">
            <h3 className="smallcaps tracking-sc border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
              Local (stdio) — Cursor / Claude Desktop
            </h3>
            <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
              <code>{server.installStdio}</code>
            </pre>
          </div>
          {server.installHttp ? (
            <div className="mt-6 border border-border bg-secondary/60">
              <h3 className="smallcaps tracking-sc border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
                Hosted (HTTP) — Claude Code / TwinMCP
              </h3>
              <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
                <code>{server.installHttp}</code>
              </pre>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              This server is typically run as a stdio child process. To share it across a team or
              keep secrets server-side, deploy it on{" "}
              <Link
                href="/"
                className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              >
                TwinMCP
              </Link>{" "}
              and connect via HTTP.
            </p>
          )}
        </section>

        {/* Setup — numbered steps, the number in a hairline square */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">Setup</h2>
          <ol className="space-y-4 text-base leading-7">
            {server.setupSteps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="lining grid h-8 w-8 shrink-0 place-items-center border border-border bg-card text-xs font-medium">
                  {i + 1}
                </span>
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Connect to your AI client — internal links into the per-client matrix */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">
            Connect {server.name} to your AI client
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MATRIX_CLIENTS.map((c) => (
              <Link
                key={c}
                href={`/servers/${server.slug}/${c}` as Route}
                className="smallcaps tracking-sc flex items-center justify-between gap-4 border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/60"
              >
                <span>
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
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">What people use it for</h2>
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

        {/* FAQ — hairline-separated rows, like the accordion ledger */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">FAQ</h2>
          <dl className="divide-y divide-border border-y border-border">
            {server.faq.map((item, i) => (
              <div key={i} className="py-5">
                <dt className="text-lg font-medium">{item.q}</dt>
                <dd className="mt-2 text-base text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Source */}
        <section className="mt-14 border border-border bg-card p-5 text-sm text-muted-foreground">
          <p>
            <strong className="smallcaps tracking-sc font-medium text-foreground">
              Package / source:
            </strong>{" "}
            <code className="bg-secondary px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              {server.packageOrImage}
            </code>
            {" — "}
            <a
              href={server.source}
              rel="noopener noreferrer"
              target="_blank"
              className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
            >
              upstream repository ↗
            </a>
          </p>
        </section>

        {/* CTA */}
        <footer className="rule-double mt-14 pt-12">
          <div className="border border-foreground/70 bg-card px-6 py-10 text-center md:px-10">
            <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
              Managed MCP Runtimes
            </p>
            <h2 className="mt-6 text-2xl font-medium md:text-3xl">
              Run {server.name} on TwinMCP in 2 minutes
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Isolated sandbox, encrypted secrets, one URL for Cursor / Claude / Windsurf. Free tier
              — no credit card.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>Start free →</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={"/plans" as Route}>See pricing</Link>
              </Button>
            </div>
          </div>

          {/* Related blog posts */}
          {server.relatedBlogSlugs.length > 0 && (
            <div className="mt-14">
              <h2 className="eyebrow mb-6 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                Related reading
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {server.relatedBlogSlugs.map((b) => (
                  <li key={b}>
                    <Link
                      href={`/blog/${b}` as Route}
                      className="group flex h-full flex-col border border-border bg-card p-5 transition-colors hover:border-foreground/60"
                    >
                      <p className="smallcaps tracking-sc text-xs text-muted-foreground">
                        Blog post
                      </p>
                      <h3 className="mt-2 text-lg font-medium leading-snug group-hover:underline group-hover:decoration-brand group-hover:underline-offset-4">
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
            <div className="mt-14">
              <h2 className="eyebrow mb-6 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                Often paired with
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/servers/${r.slug}` as Route}
                      className="group flex h-full flex-col border border-border bg-card p-5 transition-colors hover:border-foreground/60"
                    >
                      <p className="smallcaps tracking-sc text-xs text-muted-foreground">
                        {r.category}
                      </p>
                      <h3 className="smallcaps tracking-sc mt-2 text-lg font-medium leading-snug group-hover:underline group-hover:decoration-brand group-hover:underline-offset-[6px]">
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
