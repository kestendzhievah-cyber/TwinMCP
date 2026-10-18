import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVERS, getServerBySlug } from "@/lib/servers/catalog";
import {
  IDE_LABELS,
  MATRIX_CLIENTS,
  API_KEY_PLACEHOLDER,
  buildClientConfig,
  proxyUrl,
  type IdeKey,
} from "@/lib/mcp/client-config";
import { JsonLd } from "@/components/seo/json-ld";
import {
  breadcrumbListSchema,
  faqPageSchema,
  howToSchema,
  softwareApplicationSchema,
} from "@/lib/seo/schema";
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

function isClient(c: string): c is IdeKey {
  return (MATRIX_CLIENTS as string[]).includes(c);
}

// One page per (MCP server × named client) — the "Use <MCP> with <Client>"
// long-tail matrix. All static (SSG).
export function generateStaticParams() {
  return SERVERS.flatMap((s) => MATRIX_CLIENTS.map((client) => ({ slug: s.slug, client })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; client: string }>;
}): Promise<Metadata> {
  const { slug, client } = await params;
  const server = getServerBySlug(slug);
  if (!server || !isClient(client)) return {};
  const clientLabel = IDE_LABELS[client];
  return {
    title: `Use the ${server.name} with ${clientLabel} — setup guide`,
    description:
      `Connect the ${server.name} to ${clientLabel} in minutes. Copy-paste config, hosted or local, plus the tools it adds. ${server.tagline}`.slice(
        0,
        158
      ),
    alternates: { canonical: `/servers/${slug}/${client}` },
    openGraph: {
      title: `${server.name} + ${clientLabel} — TwinMCP`,
      description: `How to connect the ${server.name} to ${clientLabel}.`,
      url: `${SITE_URL}/servers/${slug}/${client}`,
      type: "article",
    },
  };
}

export default async function ServerClientPage({
  params,
}: {
  params: Promise<{ slug: string; client: string }>;
}) {
  const { slug, client } = await params;
  const server = getServerBySlug(slug);
  if (!server || !isClient(client)) notFound();

  const clientLabel = IDE_LABELS[client];
  const localCommand = server.installStdio.trim().startsWith("#") ? null : server.installStdio;

  // The TwinMCP-hosted connection snippet for this client: a remote URL + a
  // bearer key. The proxy URL/key are placeholders shown before the user mints
  // a real key in the dashboard Connect panel.
  const hostedUrl = proxyUrl(SITE_URL, "your-server", server.slug);
  const cfg = buildClientConfig(client, {
    url: hostedUrl,
    apiKey: API_KEY_PLACEHOLDER,
    label: server.slug,
  });

  const steps = [
    { name: "Create a server", text: "Create a free TwinMCP account and spin up a server." },
    {
      name: `Install ${server.name}`,
      text: `Install the ${server.name} from the marketplace in one click.`,
    },
    {
      name: "Generate a key",
      text: `Open the server's Connect panel, pick ${clientLabel}, and generate an API key.`,
    },
    {
      name: `Connect ${clientLabel}`,
      text: `Paste the config into ${clientLabel} and reload — the ${server.name} tools appear.`,
    },
  ];

  // Only surface related servers that also have a page for this client.
  const related = server.relatedSlugs
    .map((s) => getServerBySlug(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "MCP servers", url: "/servers" },
            { name: server.name, url: `/servers/${server.slug}` },
            { name: clientLabel, url: `/servers/${server.slug}/${client}` },
          ]),
          softwareApplicationSchema({ name: server.name, description: server.tagline }),
          howToSchema({
            name: `Connect the ${server.name} to ${clientLabel}`,
            description: `Set up the ${server.name} in ${clientLabel} with TwinMCP.`,
            totalTime: "PT3M",
            steps: steps.map((s) => ({ name: s.name, text: s.text })),
          }),
          faqPageSchema(server.faq),
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
            <li>
              <Link
                href={`/servers/${server.slug}` as Route}
                className="transition-colors hover:text-foreground"
              >
                {server.name}
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              {clientLabel}
            </li>
          </ol>
        </nav>

        {/* Article header: left-aligned eyebrow with a rule, serif title (a
            sentence, so no small caps), short hairline, lead, double rule. */}
        <header className="pb-10">
          <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
            Setup guide
          </p>
          <h1 className="mt-5 text-4xl font-medium sm:text-5xl">
            Use the {server.name} with {clientLabel}
          </h1>
          <div className="mt-6 h-px w-12 bg-foreground/40" />
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            {server.tagline} Here&apos;s how to connect it to {clientLabel} — hosted on TwinMCP for
            a remote URL, or run locally.
          </p>
        </header>
        <Separator variant="double" />

        <section className="mt-10 space-y-5 text-lg leading-8 text-foreground/90">
          <p>{server.description[0]}</p>
        </section>

        {/* Hosted (recommended) */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-2xl font-medium md:text-3xl">
            Connect {server.name} to {clientLabel} with TwinMCP
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Host the {server.name} on TwinMCP and connect {clientLabel} to a single remote URL — no
            local install, no runtime to babysit. Generate a key in the Connect panel, then paste:
          </p>
          <div className="mt-6 border border-border bg-secondary/60">
            <p className="flex items-center justify-between gap-4 border-b border-border px-4 py-2">
              <span className="font-mono text-xs text-foreground">{cfg.filename}</span>
              <span className="smallcaps tracking-sc text-xs text-muted-foreground">
                {cfg.language}
              </span>
            </p>
            <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
              <code>{cfg.code}</code>
            </pre>
          </div>
          <ol className="mt-8 space-y-4">
            {steps.map((s, i) => (
              <li key={s.name} className="flex gap-4">
                <span
                  aria-hidden
                  className="lining mt-0.5 grid h-8 w-8 shrink-0 place-items-center border border-border bg-card text-xs font-medium text-foreground"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="smallcaps tracking-sc block text-sm font-medium text-foreground">
                    {s.name}
                  </span>
                  <span className="mt-0.5 block text-base text-foreground/90">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Button asChild>
              <Link href={"/sign-up" as Route}>Host {server.name} free →</Link>
            </Button>
          </div>
        </section>

        {/* Local */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-2xl font-medium md:text-3xl">Or run {server.name} locally</h2>
          {localCommand ? (
            <>
              <p className="mt-3 text-base text-muted-foreground">
                Prefer to run it on your own machine? Launch the stdio server and add it to{" "}
                {clientLabel}&apos;s MCP config:
              </p>
              <div className="mt-6 border border-border bg-secondary/60">
                <p className="smallcaps tracking-sc border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
                  Local (stdio)
                </p>
                <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
                  <code>{localCommand}</code>
                </pre>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Local means the server only lives as long as {clientLabel} is open, state is
                per-session, and secrets sit in your local config. Hosting on TwinMCP keeps it
                always reachable with encrypted config.
              </p>
            </>
          ) : (
            <p className="mt-3 text-base text-muted-foreground">
              The {server.name} is hosted-only (no local stdio mode) — use the TwinMCP option above
              to connect it to {clientLabel}.
            </p>
          )}
        </section>

        {/* Tools — a ledger: small-caps header on a firmer rule, hairline rows, mono names */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-2xl font-medium md:text-3xl">
            What {server.name} adds to {clientLabel}
          </h2>
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

        {/* FAQ — hairline-separated rows */}
        {server.faq.length > 0 && (
          <section className="mt-14 border-t border-border pt-10">
            <h2 className="mb-6 text-2xl font-medium md:text-3xl">FAQ</h2>
            <div className="divide-y divide-border border-y border-border">
              {server.faq.map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="text-lg font-medium text-foreground">{f.q}</h3>
                  <p className="mt-2 text-base text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Internal links — an index block under the double rule */}
        <section className="rule-double mt-14 pt-10">
          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            <div>
              <h2 className="eyebrow mb-4 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                {server.name} elsewhere
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href={`/servers/${server.slug}` as Route}
                    className="text-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                  >
                    {server.name} — full guide
                  </Link>
                </li>
                {MATRIX_CLIENTS.filter((c) => c !== client)
                  .slice(0, 4)
                  .map((c) => (
                    <li key={c}>
                      <Link
                        href={`/servers/${server.slug}/${c}` as Route}
                        className="text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                      >
                        {server.name} with {IDE_LABELS[c]}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
            {related.length > 0 && (
              <div>
                <h2 className="eyebrow mb-4 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                  Related MCPs for {clientLabel}
                </h2>
                <ul className="space-y-2 text-sm">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/servers/${r.slug}/${client}` as Route}
                        className="text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                      >
                        {r.name} with {clientLabel}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </article>
    </>
  );
}
