import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";

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

      <article className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              Docs
            </li>
          </ol>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            TwinMCP Documentation
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Provision Model Context Protocol servers in isolated runtimes, install MCPs from
            the marketplace, and connect them to Cursor, Claude Code, Windsurf, and Cline in
            two minutes.
          </p>
        </header>

        <section id="quick-start" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Quick start</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6 text-base leading-relaxed">
            <li>
              <Link href="/sign-up" className="font-medium underline underline-offset-4">
                Create a free TwinMCP account
              </Link>{" "}
              — no credit card required.
            </li>
            <li>
              From the dashboard, click <strong>Create server</strong>, give it a name and
              pick a box size. Provisioning usually takes about 10–30 seconds.
            </li>
            <li>
              Open the <strong>Marketplace</strong> and install one or more MCPs into your
              server (GitHub, Notion, Linear, Postgres, custom HTTP, etc.).
            </li>
            <li>
              Copy the server endpoint and API key, then paste them into your IDE&apos;s MCP
              config (Cursor, Claude Code, Windsurf, Cline).
            </li>
          </ol>
        </section>

        <section id="concepts" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Core concepts</h2>

          <h3 className="mt-6 text-xl font-semibold">MCP server</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            An isolated runtime that hosts one or more Model Context Protocol servers. Each
            TwinMCP server runs in its own Upstash Box sandbox with its own secrets, file
            system, and outbound network policy.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Marketplace MCPs</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Curated, one-click installable MCPs. Install GitHub, Notion, Linear, Slack,
            Postgres, Stripe, and dozens more without writing glue code.
          </p>

          <h3 className="mt-6 text-xl font-semibold">API keys</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Each TwinMCP server is reachable via an HTTP endpoint protected by a per-user API
            key. Rotate keys from the dashboard at any time; the old key keeps working until
            you explicitly revoke it, so you can update your clients without downtime.
          </p>
        </section>

        <section id="ide-setup" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Connect your IDE</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            TwinMCP exposes a standard MCP-over-HTTP endpoint. Paste the snippet shown in
            your dashboard into one of these clients:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Cursor</strong> — Settings → Features → Model Context Protocol → Add
              server.
            </li>
            <li>
              <strong>Claude Code</strong> — <code>claude mcp add</code> with the URL and
              token from your dashboard.
            </li>
            <li>
              <strong>Windsurf</strong> — Cascade settings → MCP servers → Add HTTP server.
            </li>
            <li>
              <strong>Cline</strong> — <code>mcp.json</code> in your workspace, set transport
              to <code>http</code>.
            </li>
          </ul>
        </section>

        <section id="api" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">REST API reference</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            The TwinMCP control plane is a REST API authenticated with Bearer tokens. Full
            OpenAPI reference (interactive):
          </p>
          <p className="mt-4">
            <Link
              href={"/docs/api-reference" as Route}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Open interactive API reference →
            </Link>
          </p>
        </section>

        <section id="troubleshooting" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Troubleshooting</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Each entry quotes the exact message you&apos;ll see, so you can find it with
            Ctrl+F. If a fix doesn&apos;t work, jump to the last entry.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Server stuck on “provisioning”</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Provisioning normally takes about 30 seconds. If the badge hasn&apos;t settled
            after a couple of minutes, refresh the page — the platform automatically flags
            servers stuck longer than 15 minutes to <code>error</code>, after which the{" "}
            <strong>Start</strong> button reappears. Press it to retry. If it loops back to
            error, contact support (below) with your server slug.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            “Unauthorized — check your API key.” (HTTP 401)
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            The key in your client config is wrong, revoked, or a placeholder. Open{" "}
            <strong>Dashboard → API keys</strong>, create or copy a key (it starts with{" "}
            <code>ctx7sk_</code>), and paste it into the <code>Authorization: Bearer …</code>{" "}
            header of your client config — then restart the client so it reloads the file.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            “Server isn&apos;t running yet — start it and retry in a moment.” (HTTP 503)
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            The server is stopped or still waking up. Open the server page, press{" "}
            <strong>Start</strong>, wait for the <code>running</code> badge, then retry. Free
            runtimes sleep when idle — the first request after a pause can take a few
            seconds longer.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            Status “error” — “The runtime failed to start.”
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Open the <strong>Logs</strong> tab of the server. The most common cause is a bad
            config value on an installed MCP (an invalid API token, a wrong connection
            string). Fix the MCP&apos;s configuration, then press <strong>Start</strong>{" "}
            again.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            Claude Desktop / Zed can&apos;t connect (mcp-remote bridge)
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Clients without native HTTP support go through <code>npx -y mcp-remote</code>:
            you need Node.js 18+ installed, the first run can take a minute while npx
            downloads the bridge, and the client must be fully restarted after editing its
            config file. Use the <strong>Test connection</strong> button on the server&apos;s
            Connect panel to confirm the endpoint itself works — if the test passes, the
            problem is on the client side.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Still stuck? Contact support</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Email{" "}
            <a href="mailto:hello@twinmcp.fr" className="underline underline-offset-4">
              hello@twinmcp.fr
            </a>{" "}
            with: your <strong>server slug</strong> (shown on the server page), the{" "}
            <strong>exact error message</strong>, what the <strong>Logs</strong> tab shows,
            and roughly when it happened (with your timezone). That&apos;s everything needed
            to investigate without back-and-forth.
          </p>
        </section>

        <section id="resources">
          <h2 className="text-2xl font-semibold tracking-tight">Resources</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>
              <Link href="/plans" className="underline underline-offset-4">
                Pricing &amp; quotas
              </Link>{" "}
              — free, pro, and team tiers.
            </li>
            <li>
              <a
                href="https://modelcontextprotocol.io"
                rel="noopener noreferrer"
                target="_blank"
                className="underline underline-offset-4"
              >
                Model Context Protocol spec
              </a>
            </li>
            <li>
              <a
                href="https://github.com/kestendzhievah-cyber/TwinMCP"
                rel="noopener noreferrer"
                target="_blank"
                className="underline underline-offset-4"
              >
                TwinMCP on GitHub
              </a>
            </li>
          </ul>
        </section>
      </article>
    </>
  );
}
