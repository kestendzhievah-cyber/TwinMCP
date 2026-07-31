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
            <li>
              <Link href={`/servers/${server.slug}` as Route} className="hover:text-foreground">
                {server.name}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {clientLabel}
            </li>
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Use the {server.name} with {clientLabel}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {server.tagline} Here&apos;s how to connect it to {clientLabel} — hosted on TwinMCP for
            a remote URL, or run locally.
          </p>
        </header>

        <section className="mb-12 space-y-5 text-base leading-7 text-foreground/90">
          <p>{server.description[0]}</p>
        </section>

        {/* Hosted (recommended) */}
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">
            Connect {server.name} to {clientLabel} with TwinMCP
          </h2>
          <p className="mb-5 text-muted-foreground">
            Host the {server.name} on TwinMCP and connect {clientLabel} to a single remote URL — no
            local install, no runtime to babysit. Generate a key in the Connect panel, then paste:
          </p>
          <p className="mb-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{cfg.filename}</span>
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm">
            <code className="font-mono">{cfg.code}</code>
          </pre>
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={s.name} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground"
                >
                  {i + 1}
                </span>
                <span className="text-foreground/90">{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Link
              href={"/sign-up" as Route}
              className="inline-flex items-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Host {server.name} free →
            </Link>
          </div>
        </section>

        {/* Local */}
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">
            Or run {server.name} locally
          </h2>
          {localCommand ? (
            <>
              <p className="mb-5 text-muted-foreground">
                Prefer to run it on your own machine? Launch the stdio server and add it to{" "}
                {clientLabel}&apos;s MCP config:
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm">
                <code className="font-mono">{localCommand}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                Local means the server only lives as long as {clientLabel} is open, state is
                per-session, and secrets sit in your local config. Hosting on TwinMCP keeps it
                always reachable with encrypted config.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              The {server.name} is hosted-only (no local stdio mode) — use the TwinMCP option above
              to connect it to {clientLabel}.
            </p>
          )}
        </section>

        {/* Tools */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">
            What {server.name} adds to {clientLabel}
          </h2>
          <ul className="space-y-3">
            {server.tools.map((t) => (
              <li key={t.name} className="rounded-lg border border-border bg-card p-4">
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-sm text-foreground">
                  {t.name}
                </code>
                <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        {server.faq.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-2xl font-semibold tracking-tight">FAQ</h2>
            <div className="space-y-5">
              {server.faq.map((f) => (
                <div key={f.q}>
                  <h3 className="font-semibold text-foreground">{f.q}</h3>
                  <p className="mt-1.5 text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Internal links */}
        <section className="border-t border-border pt-8">
          <div className="flex flex-wrap gap-x-8 gap-y-6">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {server.name} elsewhere
              </h2>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <Link
                    href={`/servers/${server.slug}` as Route}
                    className="text-foreground hover:underline"
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
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {server.name} with {IDE_LABELS[c]}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
            {related.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Related MCPs for {clientLabel}
                </h2>
                <ul className="space-y-1.5 text-sm">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/servers/${r.slug}/${client}` as Route}
                        className="text-muted-foreground hover:text-foreground hover:underline"
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
