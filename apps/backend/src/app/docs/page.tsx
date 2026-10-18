import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Docs — TwinMCP",
  description:
    "TwinMCP documentation: provision MCP servers, install MCPs from the marketplace, and connect Cursor, Claude Code, Windsurf, and Cline in minutes.",
  alternates: {
    canonical: "/docs",
    languages: { en: "/docs", fr: "/fr/docs", "x-default": "/docs" },
  },
  openGraph: {
    title: "TwinMCP Documentation",
    description:
      "Learn how to provision MCP runtimes, install MCPs, and connect AI coding agents (Cursor, Claude Code, Windsurf, Cline) with TwinMCP.",
    url: `${SITE_URL}/docs`,
  },
};

// Links in running text: pinstripe navy with a hairline underline (DESIGN.md §5).
const LINK = "text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

// Section eyebrow sitting between two short hairlines (DESIGN.md §4.7).
const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";

// Numbered steps: the number pressed into a hairline square (DESIGN.md §5).
const STEP =
  "flex gap-4 [counter-increment:step] before:grid before:h-9 before:w-9 before:shrink-0 before:place-items-center before:border before:border-border before:text-sm before:font-medium before:text-foreground before:content-[counter(step)] before:[font-variant-numeric:lining-nums]";

export default function DocsPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Docs", url: "/docs" },
          ]),
          articleSchema({
            headline: "TwinMCP Documentation",
            description:
              "Reference guide for provisioning Model Context Protocol servers on TwinMCP and connecting them to AI coding agents.",
            url: "/docs",
            datePublished: "2026-05-10",
          }),
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_strong]:font-medium">
        <nav
          aria-label="Breadcrumb"
          className="smallcaps tracking-sc mb-10 text-xs text-muted-foreground"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              Docs
            </li>
          </ol>
        </nav>

        <header className="mb-14 text-center">
          <p className={EYEBROW_RULES}>Reference guide</p>
          <h1 className="display letterpress mt-5 text-4xl sm:text-5xl">TwinMCP Documentation</h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Provision Model Context Protocol servers in isolated runtimes, install MCPs from the
            marketplace, and connect them to Cursor, Claude Code, Windsurf, and Cline in two
            minutes.
          </p>
          <Separator variant="double" className="mt-10" />
        </header>

        <div className="divide-y divide-border">
          <section id="quick-start" className="py-12 first:pt-0">
            <h2 className="text-3xl font-medium">Quick start</h2>
            <ol role="list" className="mt-6 list-none space-y-5 [counter-reset:step]">
              <li className={STEP}>
                <span className="pt-1.5">
                  <Link href="/sign-up" className={LINK}>
                    Create a free TwinMCP account
                  </Link>{" "}
                  — no credit card required.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  From the dashboard, click <strong>Create server</strong>, give it a name and pick
                  a box size. Provisioning usually takes about 10–30 seconds.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Open the <strong>Marketplace</strong> and install one or more MCPs into your
                  server (GitHub, Notion, Linear, Postgres, custom HTTP, etc.).
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Copy the server endpoint and API key, then paste them into your IDE&apos;s MCP
                  config (Cursor, Claude Code, Windsurf, Cline).
                </span>
              </li>
            </ol>
          </section>

          <section id="concepts" className="py-12">
            <h2 className="text-3xl font-medium">Core concepts</h2>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="text-2xl font-medium">MCP server</h3>
                <p className="mt-2 text-base leading-7">
                  An isolated runtime that hosts one or more Model Context Protocol servers. Each
                  TwinMCP server runs in its own Upstash Box sandbox with its own secrets, file
                  system, and outbound network policy.
                </p>
              </div>

              <div className="py-5">
                <h3 className="text-2xl font-medium">Marketplace MCPs</h3>
                <p className="mt-2 text-base leading-7">
                  Curated, one-click installable MCPs. Install GitHub, Notion, Linear, Slack,
                  Postgres, Stripe, and dozens more without writing glue code.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="text-2xl font-medium">API keys</h3>
                <p className="mt-2 text-base leading-7">
                  Each TwinMCP server is reachable via an HTTP endpoint protected by a per-user API
                  key. Rotate keys from the dashboard at any time; the old key keeps working until
                  you explicitly revoke it, so you can update your clients without downtime.
                </p>
              </div>
            </div>
          </section>

          <section id="ide-setup" className="py-12">
            <h2 className="text-3xl font-medium">Connect your IDE</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              TwinMCP exposes a standard MCP-over-HTTP endpoint. Paste the snippet shown in your
              dashboard into one of these clients:
            </p>
            <ul role="list" className="mt-6 divide-y divide-border border-y border-border">
              <li className="py-3 leading-7">
                <strong className="smallcaps tracking-sc">Cursor</strong> — Settings → Features →
                Model Context Protocol → Add server.
              </li>
              <li className="py-3 leading-7">
                <strong className="smallcaps tracking-sc">Claude Code</strong> —{" "}
                <code>claude mcp add</code> with the URL and token from your dashboard.
              </li>
              <li className="py-3 leading-7">
                <strong className="smallcaps tracking-sc">Windsurf</strong> — Cascade settings → MCP
                servers → Add HTTP server.
              </li>
              <li className="py-3 leading-7">
                <strong className="smallcaps tracking-sc">Cline</strong> — <code>mcp.json</code> in
                your workspace, set transport to <code>http</code>.
              </li>
            </ul>
          </section>

          <section id="api" className="py-12">
            <h2 className="text-3xl font-medium">REST API reference</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              The TwinMCP control plane is a REST API authenticated with Bearer tokens. Full OpenAPI
              reference (interactive):
            </p>
            <p className="mt-6">
              <Button asChild variant="outline">
                <Link href={"/docs/api-reference" as Route}>Open interactive API reference →</Link>
              </Button>
            </p>
          </section>

          <section id="troubleshooting" className="py-12">
            <h2 className="text-3xl font-medium">Troubleshooting</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Each entry quotes the exact message you&apos;ll see, so you can find it with Ctrl+F.
              If a fix doesn&apos;t work, jump to the last entry.
            </p>

            <div className="mt-6 divide-y divide-border">
              <div className="py-6 first:pt-0">
                <h3 className="text-2xl font-medium">Server stuck on “provisioning”</h3>
                <p className="mt-2 text-base leading-7">
                  Provisioning normally takes about 30 seconds. If the badge hasn&apos;t settled
                  after a couple of minutes, refresh the page — the platform automatically flags
                  servers stuck longer than 15 minutes to <code>error</code>, after which the{" "}
                  <strong>Start</strong> button reappears. Press it to retry. If it loops back to
                  error, contact support (below) with your server slug.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  “Unauthorized — check your API key.” (HTTP 401)
                </h3>
                <p className="mt-2 text-base leading-7">
                  The key in your client config is wrong, revoked, or a placeholder. Open{" "}
                  <strong>Dashboard → API keys</strong>, create or copy a key (it starts with{" "}
                  <code>ctx7sk_</code>), and paste it into the <code>Authorization: Bearer …</code>{" "}
                  header of your client config — then restart the client so it reloads the file.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  “Server isn&apos;t running yet — start it and retry in a moment.” (HTTP 503)
                </h3>
                <p className="mt-2 text-base leading-7">
                  The server is stopped or still waking up. Open the server page, press{" "}
                  <strong>Start</strong>, wait for the <code>running</code> badge, then retry. Free
                  runtimes sleep when idle — the first request after a pause can take a few seconds
                  longer.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  Status “error” — “The runtime failed to start.”
                </h3>
                <p className="mt-2 text-base leading-7">
                  Open the <strong>Logs</strong> tab of the server. The most common cause is a bad
                  config value on an installed MCP (an invalid API token, a wrong connection
                  string). Fix the MCP&apos;s configuration, then press <strong>Start</strong>{" "}
                  again.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  Claude Desktop / Zed can&apos;t connect (mcp-remote bridge)
                </h3>
                <p className="mt-2 text-base leading-7">
                  Clients without native HTTP support go through <code>npx -y mcp-remote</code>: you
                  need Node.js 18+ installed, the first run can take a minute while npx downloads
                  the bridge, and the client must be fully restarted after editing its config file.
                  Use the <strong>Test connection</strong> button on the server&apos;s Connect panel
                  to confirm the endpoint itself works — if the test passes, the problem is on the
                  client side.
                </p>
              </div>

              <div className="py-6 last:pb-0">
                <h3 className="text-2xl font-medium">Still stuck? Contact support</h3>
                <p className="mt-2 text-base leading-7">
                  Email{" "}
                  <a href="mailto:hello@twinmcp.fr" className={LINK}>
                    hello@twinmcp.fr
                  </a>{" "}
                  with: your <strong>server slug</strong> (shown on the server page), the{" "}
                  <strong>exact error message</strong>, what the <strong>Logs</strong> tab shows,
                  and roughly when it happened (with your timezone). That&apos;s everything needed
                  to investigate without back-and-forth.
                </p>
              </div>
            </div>
          </section>

          <section id="resources" className="py-12 last:pb-0">
            <h2 className="text-3xl font-medium">Resources</h2>
            <ul role="list" className="mt-6 divide-y divide-border border-y border-border">
              <li className="py-3 leading-7">
                <Link href="/plans" className={LINK}>
                  Pricing &amp; quotas
                </Link>{" "}
                <span className="text-muted-foreground">— free, pro, and team tiers.</span>
              </li>
              <li className="py-3 leading-7">
                <a
                  href="https://modelcontextprotocol.io"
                  rel="noopener noreferrer"
                  target="_blank"
                  className={LINK}
                >
                  Model Context Protocol spec
                </a>
              </li>
              <li className="py-3 leading-7">
                <a
                  href="https://github.com/kestendzhievah-cyber/TwinMCP"
                  rel="noopener noreferrer"
                  target="_blank"
                  className={LINK}
                >
                  TwinMCP on GitHub
                </a>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </>
  );
}
