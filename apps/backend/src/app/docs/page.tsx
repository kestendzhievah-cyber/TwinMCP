import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Button } from "@/components/ui/button";
import { SOCIAL_LINKS } from "@/lib/site-links";
import { ClientSetupList } from "@/components/docs/client-setup-list";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";
import { docsExampleUrl } from "@/components/docs/client-setup";
import {
  MANAGEMENT_SCOPE_MESSAGE,
  REQUEST_ID_HEADER,
  RPC_CODES,
  SERVER_SCOPE_MESSAGE,
  TROUBLESHOOTING_ANCHOR,
  docsPlanFacts,
  formatCount,
  rotationOverlapHours,
} from "@/components/docs/docs-facts";
import { API_KEY_PLACEHOLDER, IDE_LABELS, MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import { TOOL_POLICY_DENIED_CODE } from "@/lib/mcp/aggregate";
import { CREDIT_RPC_CODE, CreditDocsSection } from "@/components/pricing/credit-docs-section";
import { walletFacts } from "@/components/pricing/wallet-copy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const CLIENT_NAMES = MATRIX_CLIENTS.map((k) => IDE_LABELS[k]);

export const metadata: Metadata = {
  title: "Docs — TwinMCP",
  description: `TwinMCP documentation: provision MCP servers, install MCPs from the marketplace, connect ${CLIENT_NAMES.join(", ")}, and fix common errors.`,
  alternates: {
    canonical: "/docs",
    languages: { en: "/docs", fr: "/fr/docs", "x-default": "/docs" },
  },
  openGraph: {
    title: "TwinMCP Documentation",
    description:
      "Provision MCP runtimes, install MCPs, connect your AI coding agents and troubleshoot errors with TwinMCP.",
    url: `${SITE_URL}/docs`,
  },
};

// Links in running text: brand blue, and underlined at rest (colour alone is
// not enough next to navy body text).
const LINK =
  "font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

// Numbered steps: the number in a brand-blue circle, as on the home page.
const STEP =
  "flex gap-4 [counter-increment:step] before:grid before:h-9 before:w-9 before:shrink-0 before:place-items-center before:rounded-full before:bg-brand before:text-sm before:font-semibold before:tabular-nums before:text-brand-foreground before:content-[counter(step)]";

// "On this page" chips under the header.
const TOC_LINK =
  "inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-input hover:text-brand";

// Account facts from lib/plan-features.ts, prices from lib/wallet/pricing.ts
// (via wallet-copy.ts); key rules from lib/auth/key-scope.ts. Never hand-typed.
const FACTS = docsPlanFacts();
const WALLET = walletFacts("en");
const n = (v: number) => formatCount(v, "en");
const OVERLAP_HOURS = rotationOverlapHours();

// The JSON-RPC error shape the MCP proxy returns (contract K2).
const ERROR_EXAMPLE = JSON.stringify(
  {
    jsonrpc: "2.0",
    id: 1,
    error: {
      code: RPC_CODES.wrongServer,
      message: SERVER_SCOPE_MESSAGE,
      data: {
        requestId: "<uuid>",
        docsUrl: `https://twinmcp.fr/docs#${TROUBLESHOOTING_ANCHOR}`,
      },
    },
  },
  null,
  2
);

const REQUEST_ID_CURL = [
  `curl -si -X POST ${docsExampleUrl("en")} \\`,
  `  -H "Authorization: Bearer ${API_KEY_PLACEHOLDER}" \\`,
  '  -H "Content-Type: application/json" \\',
  '  -H "Accept: application/json, text/event-stream" \\',
  `  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | grep -i ${REQUEST_ID_HEADER}`,
].join("\n");

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

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 [&_code]:rounded-md [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_strong]:font-semibold">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="font-medium text-foreground">
              Docs
            </li>
          </ol>
        </nav>

        <header className="mb-12">
          <p className="eyebrow">Reference guide</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            TwinMCP Documentation
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Provision Model Context Protocol servers in isolated runtimes, install MCPs from the
            marketplace, and connect them to Cursor, Claude Code, VS Code and every other MCP client
            in two minutes.
          </p>
          <nav aria-label="On this page" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <a href="#quick-start" className={TOC_LINK}>
                  Quick start
                </a>
              </li>
              <li>
                <a href="#concepts" className={TOC_LINK}>
                  Core concepts
                </a>
              </li>
              <li>
                <a href="#ide-setup" className={TOC_LINK}>
                  Connect your IDE
                </a>
              </li>
              <li>
                <a href="#api-keys" className={TOC_LINK}>
                  API keys
                </a>
              </li>
              <li>
                <a href="#lifecycle" className={TOC_LINK}>
                  Server lifecycle
                </a>
              </li>
              <li>
                <a href="#credit" className={TOC_LINK}>
                  Credits & pricing
                </a>
              </li>
              <li>
                <a href="#api" className={TOC_LINK}>
                  REST API
                </a>
              </li>
              <li>
                <a href="#troubleshooting" className={TOC_LINK}>
                  Troubleshooting
                </a>
              </li>
              <li>
                <a href="#resources" className={TOC_LINK}>
                  Resources
                </a>
              </li>
            </ul>
          </nav>
        </header>

        <div className="divide-y divide-border border-t border-border">
          <section id="quick-start" className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Quick start
            </h2>
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
                  From the dashboard, click <strong>New server</strong>, give it a name and pick a
                  box size. Provisioning usually takes about 10–30 seconds.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Open the <strong>Marketplace</strong> and install one or more MCPs into your
                  server (GitLab, Notion, Linear, Postgres, Slack, etc.).
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Copy the MCP&apos;s URL and an API key from the server&apos;s{" "}
                  <strong>Connect</strong> panel, then paste them into your client&apos;s MCP config
                  —{" "}
                  <a href="#ide-setup" className={LINK}>
                    every supported client
                  </a>{" "}
                  is listed below.
                </span>
              </li>
            </ol>
          </section>

          <section id="concepts" className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Core concepts
            </h2>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">MCP server</h3>
                <p className="mt-2 text-base leading-7">
                  An isolated runtime that hosts one or more Model Context Protocol servers. Each
                  TwinMCP server runs in its own Upstash Box sandbox with its own encrypted secrets
                  and file system.
                </p>
              </div>

              <div className="py-5">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Marketplace MCPs
                </h3>
                <p className="mt-2 text-base leading-7">
                  Curated, one-click installable MCPs. Install GitLab, Notion, Linear, Slack,
                  Postgres, Stripe, and dozens more without writing glue code. Each installed MCP
                  gets its own URL, <code>{docsExampleUrl("en")}</code>, served over Streamable
                  HTTP.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">Your own MCP</h3>
                <p className="mt-2 text-base leading-7">
                  Once your account is funded (after a first top-up),{" "}
                  <strong>Publish an MCP</strong> packages any stdio MCP server — an npm package run
                  with <code>npx</code> or a PyPI package run with <code>uvx</code> — so you can
                  install it on your servers like a marketplace MCP. It is reached over the same
                  Streamable HTTP URL as every other MCP.
                </p>
              </div>
            </div>
          </section>

          <section id="ide-setup" className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Connect your IDE
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              TwinMCP exposes a standard Streamable HTTP endpoint per MCP. Below is the exact block
              for each supported client, with an example URL and the key placeholder{" "}
              <code>{API_KEY_PLACEHOLDER}</code>. The server&apos;s <strong>Connect</strong> panel
              in the dashboard generates the same block with your real URL and key.
            </p>
            <ClientSetupList locale="en" />
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Another client? Any MCP client that speaks Streamable HTTP works: give it the URL and
              the header <code>Authorization: Bearer ctx7sk_…</code>. A stdio-only client can go
              through <code>npx -y mcp-remote</code>, as in the Claude Desktop block.
            </p>
          </section>

          <section id="api-keys" className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">API keys</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Every MCP request carries a TwinMCP key (prefix <code>ctx7sk_</code>) in the{" "}
              <code>Authorization: Bearer</code> header. Create keys in{" "}
              <strong>Dashboard → API keys</strong>: {n(FACTS.freeKeys)} keys before your first
              top-up, {n(FACTS.proKeys)} after it.
            </p>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Full-access keys
                </h3>
                <p className="mt-2 text-base leading-7">
                  Reach the REST API (servers, keys, billing) and every MCP on every one of your
                  servers. Keep them for scripts that manage your account, never in a shared config
                  file.
                </p>
              </div>

              <div className="py-5">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  MCP-proxy keys
                </h3>
                <p className="mt-2 text-base leading-7">
                  Can only call MCP endpoints, and can be bound to a single server. This is the key
                  to paste into an IDE config, where it sits in plain text: if it leaks, it cannot
                  manage your account, and a bound key cannot reach your other servers. The REST API
                  answers such a key with HTTP 403 (“{MANAGEMENT_SCOPE_MESSAGE}”), and a bound key
                  used on another server gets HTTP 403, JSON-RPC{" "}
                  <code>{RPC_CODES.wrongServer}</code>.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Rotation, expiry and revocation
                </h3>
                <p className="mt-2 text-base leading-7">
                  <strong>Rotate</strong> mints a replacement with the same name, scope and server
                  binding; the old key keeps working for {OVERLAP_HOURS} hours so you can update
                  your clients without downtime, then stops, and rotating never uses an extra key
                  slot. During that window the old key can no longer create, rotate or revoke keys
                  (HTTP 403). <strong>Revoke</strong> takes effect immediately. A key past its
                  expiry date is rejected exactly like a revoked one.
                </p>
              </div>
            </div>
          </section>

          <section id="lifecycle" className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Server lifecycle
            </h2>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">Pause</h3>
                <p className="mt-2 text-base leading-7">
                  Pauses the server&apos;s box and keeps its disk: installed MCPs, their
                  configuration, secrets and data are all kept. The next MCP request — or{" "}
                  <strong>Resume</strong> on the server page — starts it again; that first request
                  can take a little longer while the box wakes up (see{" "}
                  <a href="#troubleshooting" className={LINK}>
                    waking up
                  </a>
                  ). An idle server can also be paused automatically and wakes the same way.
                </p>
              </div>

              <div className="py-5">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Delete runtime
                </h3>
                <p className="mt-2 text-base leading-7">
                  Destroys the server&apos;s box and the data stored in it. It asks you to type the
                  server name first and cannot be undone. Use <strong>Pause</strong> whenever you
                  only want the server to stop running.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">Restart</h3>
                <p className="mt-2 text-base leading-7">
                  Recreates the runtime: the current box is deleted and a fresh one is created,
                  reinstalling every MCP from its saved configuration. Files written inside the old
                  box are lost, so Restart also asks you to type the server name.
                </p>
              </div>
            </div>
          </section>

          <CreditDocsSection locale="en" />

          <section id="api" className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              REST API reference
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              The TwinMCP control plane is a REST API authenticated with Bearer tokens (a
              full-access key). Full OpenAPI reference (interactive):
            </p>
            <p className="mt-6">
              <Button asChild variant="outline">
                <Link href={"/docs/api-reference" as Route}>Open interactive API reference →</Link>
              </Button>
            </p>
          </section>

          <section id={TROUBLESHOOTING_ANCHOR} className="scroll-mt-24 py-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Troubleshooting
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Each entry quotes the exact message you&apos;ll see, so you can find it with Ctrl+F.
              Errors from an MCP endpoint are JSON-RPC errors whose <code>error.data</code> carries
              a <code>requestId</code> and a link back to this section:
            </p>
            <DocsCodeBlock code={ERROR_EXAMPLE} language="json" locale="en" className="mt-4" />

            <div className="mt-6 divide-y divide-border">
              <div className="py-6 first:pt-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Server stuck on “provisioning”
                </h3>
                <p className="mt-2 text-base leading-7">
                  Provisioning normally takes about 30 seconds. If the badge hasn&apos;t settled
                  after a couple of minutes, refresh the page — the platform automatically flags
                  servers stuck longer than 15 minutes to <code>error</code>, after which the{" "}
                  <strong>Start</strong> button reappears. Press it to retry. If it loops back to
                  error, contact support (below) with your server slug.
                </p>
              </div>

              <div id="error-401" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “Invalid API key” (HTTP 401)
                </h3>
                <p className="mt-2 text-base leading-7">
                  The key in your client config is wrong, revoked, expired (including an old key{" "}
                  {OVERLAP_HOURS} hours after a rotation), or still the placeholder{" "}
                  <code>{API_KEY_PLACEHOLDER}</code>. The dashboard&apos;s{" "}
                  <strong>Test connection</strong> reports it as “Unauthorized — check your API
                  key.” Open <strong>Dashboard → API keys</strong>, create or copy a key (it starts
                  with <code>ctx7sk_</code>), and paste it into the{" "}
                  <code>Authorization: Bearer …</code> header of your client config — then restart
                  the client so it reloads the file.
                </p>
              </div>

              <div id="error-403" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “{SERVER_SCOPE_MESSAGE}” (HTTP 403, JSON-RPC {RPC_CODES.wrongServer})
                </h3>
                <p className="mt-2 text-base leading-7">
                  The key is an{" "}
                  <a href="#api-keys" className={LINK}>
                    MCP-proxy key
                  </a>{" "}
                  bound to a different server. Use a key bound to this server — the server&apos;s{" "}
                  <strong>Connect</strong> panel picks or creates one — or a proxy key that is not
                  bound to any server. The same key calling the REST API gets HTTP 403 “
                  {MANAGEMENT_SCOPE_MESSAGE}”.
                </p>
              </div>

              <div id="error-402" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “Your TwinMCP credit is used up” (HTTP 402, JSON-RPC {CREDIT_RPC_CODE})
                </h3>
                <p className="mt-2 text-base leading-7">
                  Your balance is at zero, so the tool call was refused before it reached the MCP,
                  and it was not charged. Only <code>tools/call</code> is refused —{" "}
                  <code>initialize</code>, <code>tools/list</code>, notifications and pings still
                  answer. Top up from {WALLET.minTopup} under <strong>Dashboard → Billing</strong>{" "}
                  (the error&apos;s <code>error.data.topupUrl</code> links there), then retry. To
                  avoid it, turn on auto-recharge. See{" "}
                  <a href="#credit" className={LINK}>
                    Credits &amp; pricing
                  </a>
                  .
                </p>
              </div>

              <div id="error-429" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “Too many requests” (HTTP 429)
                </h3>
                <p className="mt-2 text-base leading-7">
                  Too many tool calls in a short time from one account: a per-minute limit protects
                  the platform from runaway loops. There is no daily cap — your balance is the only
                  limit on volume. Wait a moment and retry; when the response carries{" "}
                  <code>Retry-After</code> (seconds), wait that long.
                </p>
              </div>

              <div id="error-503" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “Waking up” or “still installing” (HTTP 503, JSON-RPC {RPC_CODES.notReady})
                </h3>
                <p className="mt-2 text-base leading-7">
                  The server is waking from a pause or the MCP is still installing. The first
                  install of an MCP takes about a minute (the package is downloaded into the box);
                  waking a paused server can take up to about 30 seconds. The request did not reach
                  the MCP: retry after the <code>Retry-After</code> delay. The dashboard&apos;s{" "}
                  <strong>Test connection</strong> shows “… is still installing — this takes about a
                  minute.”
                </p>
              </div>

              <div id="paused" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  The server is paused
                </h3>
                <p className="mt-2 text-base leading-7">
                  A paused server resumes on its next MCP request — the proxy wakes the box and
                  usually answers that request, a little slower; if the wake fails or the box is
                  still warming up you get the 503 above, so retry — or press{" "}
                  <strong>Resume</strong> on the server page. Nothing was deleted: see{" "}
                  <a href="#lifecycle" className={LINK}>
                    Server lifecycle
                  </a>
                  . If the server shows <code>stopped</code> or <code>error</code> instead, press{" "}
                  <strong>Start</strong> and wait for the <code>running</code> badge.
                </p>
              </div>

              <div id="error-504" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “The MCP server did not answer in time.” (HTTP 504, JSON-RPC {RPC_CODES.uncertain}
                  )
                </h3>
                <p className="mt-2 text-base leading-7">
                  A tool call timed out. It may still have run, so TwinMCP does not resend it — a
                  tool with side effects (sending a message, writing a row) never runs twice. Check
                  whether the action happened before you retry.
                </p>
              </div>

              <div id="tool-blocked" className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  “Tool … is blocked by this MCP&apos;s tool access policy” (HTTP 200, JSON-RPC{" "}
                  {TOOL_POLICY_DENIED_CODE})
                </h3>
                <p className="mt-2 text-base leading-7">
                  The MCP&apos;s tool access policy refused the call before it reached the MCP — a
                  block list, read-only mode (only tools marked <code>readOnlyHint</code>) or an
                  allow-list. The tool did not run. To change it, open the server, then{" "}
                  <strong>Tool access</strong> on the MCP in <strong>Installed MCPs</strong>.
                </p>
              </div>

              <div className="py-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
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
                <h3 className="font-display text-xl font-semibold tracking-tight">
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

              <div id="support" className="py-6 last:pb-0">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Still stuck? Contact support
                </h3>
                <p className="mt-2 text-base leading-7">
                  Email{" "}
                  <a href="mailto:hello@twinmcp.fr" className={LINK}>
                    hello@twinmcp.fr
                  </a>{" "}
                  with: the <strong>request ID</strong>, your <strong>server slug</strong> (shown on
                  the server page), the <strong>exact error message</strong>, what the{" "}
                  <strong>Logs</strong> tab shows, and roughly when it happened (with your
                  timezone). Every response from an MCP endpoint carries the request ID in the{" "}
                  <code>{REQUEST_ID_HEADER}</code> header, and error bodies repeat it as{" "}
                  <code>error.data.requestId</code>. To read the header yourself:
                </p>
                <DocsCodeBlock
                  code={REQUEST_ID_CURL}
                  language="bash"
                  locale="en"
                  className="mt-4"
                />
              </div>
            </div>
          </section>

          <section id="resources" className="scroll-mt-24 py-12 last:pb-0">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Resources
            </h2>
            <ul
              role="list"
              className="mt-6 divide-y divide-border rounded-xl border border-border bg-card px-4"
            >
              <li className="py-3 leading-7">
                <Link href="/plans" className={LINK}>
                  Pricing
                </Link>{" "}
                <span className="text-muted-foreground">
                  — the price list, what {WALLET.signupCredit} buys, and a cost estimator.
                </span>
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
              {SOCIAL_LINKS.github && (
                <li className="py-3 leading-7">
                  <a
                    href={SOCIAL_LINKS.github}
                    rel="noopener noreferrer"
                    target="_blank"
                    className={LINK}
                  >
                    TwinMCP on GitHub
                  </a>
                </li>
              )}
            </ul>
          </section>
        </div>
      </article>
    </>
  );
}
