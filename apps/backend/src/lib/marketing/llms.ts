// /llms.txt and /llms-full.txt (https://llmstxt.org): a plain-text brief that
// AI assistants can read to answer questions about TwinMCP correctly. Every
// number comes from the code that enforces it (lib/plan-features.ts for the
// allowances, lib/wallet/pricing.ts via components/pricing/wallet-copy.ts for
// the prices, lib/wallet/eligibility.ts for the MCPs held back from the
// sign-up credit), so the brief cannot drift from the product. No SLA, SSO,
// region choice, always-on, certification, EU-residency, team-sharing or
// refund claim: none is sold.
//
// Pricing since 2026-10-29: a prepaid wallet, no subscription, no daily cap.
// Pure. Unit-tested in src/__tests__/llms.test.ts.

import { PLAN_CAPABILITIES, maxMcpsForBoxSize } from "@/lib/plan-features";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { PRICE_TABLE, TEN_EURO, walletFacts } from "@/components/pricing/wallet-copy";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { IDE_LABELS, MATRIX_CLIENTS, buildServerUrl, proxyUrl } from "@/lib/mcp/client-config";
import { SERVERS } from "@/lib/servers/catalog";
import { CHANGELOG, dayLabel } from "@/lib/marketing/changelog";

export interface LlmsFacts {
  /** Canonical site origin, e.g. https://twinmcp.fr (no trailing slash needed). */
  siteUrl: string;
}

/** Where proxy errors point (K2 contract: error.data.docsUrl). */
export const TROUBLESHOOTING_PATH = "/docs#troubleshooting";
/** Where credit, prices and the zero-balance behaviour are documented. */
export const CREDIT_DOCS_PATH = "/docs#credit";
/** The OpenAPI document of the control-plane REST API (app/api/openapi/route.ts). */
export const OPENAPI_PATH = "/api/openapi";

const n = (value: number) => value.toLocaleString("en-US");

function origin(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

function planFacts() {
  const w = walletFacts("en");
  const excluded = PROMO_EXCLUDED_MCP_SLUGS.map(
    (slug) => SERVERS.find((s) => s.slug === slug)?.name ?? slug
  );
  return {
    w,
    free: PLAN_CAPABILITIES.free,
    pro: PLAN_CAPABILITIES.pro,
    small: maxMcpsForBoxSize("small"),
    medium: maxMcpsForBoxSize("medium"),
    large: maxMcpsForBoxSize("large"),
    creditCalls: n(TEN_EURO.toolCalls),
    excluded: excluded.join(", "),
    presets: w.presets.join(", "),
  };
}

function clientList(): string {
  return MATRIX_CLIENTS.map((c) => IDE_LABELS[c]).join(", ");
}

/** The recommended connection: one URL for the whole server. */
function exampleServerUrl(siteUrl: string): string {
  return buildServerUrl(origin(siteUrl), "<server-slug>");
}

/** Still available: one URL per installed MCP. */
function exampleUrl(siteUrl: string): string {
  return proxyUrl(origin(siteUrl), "<server-slug>", "<mcp-slug>");
}

/** The short brief served at /llms.txt. */
export function buildLlmsTxt(f: LlmsFacts): string {
  const site = origin(f.siteUrl);
  const p = planFacts();
  return [
    "# TwinMCP",
    "",
    `> TwinMCP hosts Model Context Protocol (MCP) servers. The ${SERVERS.length} MCPs of the catalogue install on any account (the few that run code or a browser after a first top-up); any other MCP server (your own or a third-party one, stdio included) must be published from its npm or PyPI package once the account is funded. Each server runs in its own isolated sandbox (an Upstash Box) and is reachable over Streamable HTTP from every MCP client: ${clientList()}, and any client that speaks Streamable HTTP. Pay as you go from a prepaid balance, no subscription.`,
    "",
    "Key facts:",
    `- Pricing: usage-based, prepaid, in euros. Tool calls cost ${p.w.per1000Calls} per 1,000; compute costs ${p.w.cpuHour.small} per active CPU-hour on a small box (${p.w.largerSizes}). Top-ups from ${p.w.minTopup}. No subscription.`,
    `- Sign-up credit: ${p.w.signupCredit} of promotional credit, valid ${p.w.signupDays} days, no credit card, one per person. Until the first top-up: ${p.free.servers} server (small box), up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs, ${p.free.apiKeys} API keys; ${p.excluded} need a first top-up.`,
    `- After the first top-up: ${p.pro.servers} servers, small/medium/large boxes (up to ${p.small}, ${p.medium} or ${p.large} MCPs each), ${p.pro.apiKeys} API keys, publish your own MCPs, 90-day audit logs, usage export.`,
    "- Only tool calls (JSON-RPC tools/call) that reach the MCP are charged; connecting, listing tools and pings are free. At a zero balance, tool calls are refused with HTTP 402 (JSON-RPC error -32008) and servers pause: nothing is charged beyond the balance unless auto-recharge is turned on.",
    `- Connect (recommended): one URL for the whole server, ${exampleServerUrl(site)}, exposing every installed MCP's tools as <mcp>__<tool>; add ?mode=router on large servers to list three meta-tools instead. Each MCP also keeps its own URL, ${exampleUrl(site)}.`,
    '- Authenticate with the header "Authorization: Bearer <API key>". Keys belong to the account and start with ctx7sk_: "full" keys manage the account, "mcp_proxy" keys only reach the MCP proxy and can be bound to one server. Clients without native HTTP support use npx mcp-remote.',
    "",
    "## Docs",
    `- [Documentation](${site}/docs): setup, client configuration, REST API`,
    `- [Troubleshooting](${site}${TROUBLESHOOTING_PATH}): every error message and its fix`,
    `- [API reference](${site}/docs/api-reference): interactive reference of the control-plane REST API`,
    `- [OpenAPI document](${site}${OPENAPI_PATH}): machine-readable JSON`,
    "",
    "## Product",
    `- [Pricing](${site}/plans): the price list, what the sign-up credit buys, and a cost estimator`,
    `- [Credit and pricing docs](${site}${CREDIT_DOCS_PATH}): the wallet, top-ups, auto-recharge, what happens at zero`,
    `- [MCP server catalogue](${site}/servers): hosted MCPs with per-client setup guides`,
    `- [Compare](${site}/compare): sourced comparisons with Composio, Smithery and self-hosting`,
    `- [Solutions](${site}/solutions): MCP packs per team`,
    `- [Migrate from Smithery](${site}/migrate-from-smithery): move your MCPs to TwinMCP`,
    `- [Security](${site}/security): sandbox isolation, encrypted secrets, API keys`,
    `- [Guided setup](${site}/demo): request help setting up your servers`,
    `- [Changelog](${site}/changelog): what shipped, month by month`,
    "",
    "## Optional",
    `- [Full brief](${site}/llms-full.txt): every fact above in more detail, the catalogue pages and the changelog`,
    `- [Use cases](${site}/use-cases)`,
    `- [Blog](${site}/blog)`,
    `- [French site](${site}/fr): tarifs ${site}/fr/tarifs, sécurité ${site}/fr/securite, migration ${site}/fr/migrer-depuis-smithery`,
    "",
  ].join("\n");
}

/** The long brief served at /llms-full.txt. */
export function buildLlmsFullTxt(f: LlmsFacts): string {
  const site = origin(f.siteUrl);
  const p = planFacts();
  const latest = CHANGELOG.slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((e) => `- ${dayLabel(e.date)}: ${e.en.title}. ${e.en.body}`);

  return [
    "# TwinMCP — full brief",
    "",
    "> Managed hosting for Model Context Protocol (MCP) servers, at https://twinmcp.fr. This file is generated from the product's own plan and price code.",
    "",
    "## What TwinMCP does",
    `- Hosts MCP servers from the catalogue of ${SERVERS.length} (Fetch, Wikipedia, Memory, Notion, Linear, Postgres, Slack, Stripe, Supabase and more) on any account. Any server outside the catalogue (your own or a third-party one, stdio included) must be published, once the account is funded, from its npm (Node.js) or PyPI (Python) package. Published MCPs stay private to your account.`,
    "- Each server is an isolated sandbox (an Upstash Box micro-VM). Inside it, MCPs run with npx or uvx, and a stdio-to-Streamable-HTTP bridge exposes each one.",
    "- Clients never reach the sandbox directly: they call the TwinMCP proxy, which authenticates the API key, checks the account has credit and relays the Streamable HTTP session (POST, GET stream, DELETE).",
    "- Secrets such as API tokens and connection strings are stored encrypted at rest (AES-256-GCM) in each MCP's config; a value used by several MCPs can live once in the account vault and be referenced as {{secret:NAME}}. Live logs show what happens on each server.",
    "- Idle servers can pause; the first request after a pause wakes them, which can take a few extra seconds.",
    "- Servers that only ship as a Docker image or a Go binary cannot run in the sandbox today.",
    "",
    "## How to connect",
    `1. Create a free account at ${site}/sign-up (French: ${site}/fr/inscription).`,
    "2. Create a server and install MCPs from the catalogue.",
    "3. Create an API key in Dashboard → API keys. Keys start with ctx7sk_ and belong to the account; for a client, an MCP-proxy key bound to the server is the narrowest choice.",
    `4. Use the server's URL, ${exampleServerUrl(site)} (recommended; append ?mode=router for servers with many tools), or one MCP's URL, ${exampleUrl(site)}, with the header "Authorization: Bearer <API key>". The dashboard generates the exact config block for ${clientList()}.`,
    '5. Clients that only load stdio servers (Claude Desktop, Zed) bridge the URL with: npx -y mcp-remote <url> --header "Authorization: Bearer <API key>" (Node.js 18+ required).',
    "",
    "Proxy answers to expect:",
    "- 401: missing, wrong, revoked or expired API key.",
    "- 403 with JSON-RPC error -32003: the API key is restricted to another server.",
    "- 402 with JSON-RPC error -32008: the credit is used up; top up at /dashboard/billing. Tool calls refused this way are not charged.",
    "- 429: too many requests in a short time (per-minute abuse limit); wait and retry.",
    "- 503: the server is stopped, still installing or waking up; retry shortly.",
    `- Every proxy response carries an x-twinmcp-request-id header; proxy errors include it with a link to ${site}${TROUBLESHOOTING_PATH}.`,
    "",
    "## Pricing",
    `- No subscription: a prepaid balance in euros, spent on what servers use. Tool calls: ${p.w.per1000Calls} per 1,000 (one per JSON-RPC tools/call that reaches the MCP, tool errors included). Compute: active CPU time as the box measures it, ${p.w.cpuHour.small} per CPU-hour on small; ${p.w.largerSizes}; a paused server uses none, an awake idle one very little. If a box does not report its CPU time, compute is estimated from the time the server is awake (marked estimated in the history).`,
    "- Free: initialize, tools/list, ping, notifications, session handshakes, and calls TwinMCP refuses.",
    `- Sign-up credit: ${p.w.signupCredit} of promotional credit, valid ${p.w.signupDays} days, no credit card, one per person, spent before paid credit (about ${p.creditCalls} tool calls' worth, before the compute those calls use). Until the first top-up: ${p.free.servers} server on a small box, up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs, ${p.free.apiKeys} API keys, live logs, community support; ${p.excluded} need a first top-up.`,
    `- Top-ups: ${p.presets} or any amount from ${p.w.minTopup} to ${p.w.maxTopup}, by card through Stripe. The first top-up unlocks ${p.pro.servers} servers, small/medium/large boxes running up to ${p.small}, ${p.medium} or ${p.large} MCPs each, ${p.pro.apiKeys} API keys, publishing your own MCPs, audit logs kept 90 days, usage export and priority email support.`,
    "- Auto-recharge: optional, off by default; tops up when the balance falls below a threshold, up to a monthly cap the user sets.",
    "- At zero: tool calls are refused with HTTP 402 (JSON-RPC -32008) and servers pause. Nothing is charged beyond the balance unless auto-recharge is on. Paid credit has no expiry date while the account is open; promotional credit expires after its validity.",
    `- ${PRICE_TABLE.notes.en[0]}`,
    "- Not offered: uptime SLA, SSO, choice of region, compliance certifications, team sharing.",
    "",
    "## Key URLs",
    `- Docs: ${site}/docs`,
    `- Troubleshooting: ${site}${TROUBLESHOOTING_PATH}`,
    `- API reference: ${site}/docs/api-reference`,
    `- OpenAPI document (JSON): ${site}${OPENAPI_PATH}`,
    `- Pricing: ${site}/plans (French: ${site}/fr/tarifs)`,
    `- Credit and pricing docs: ${site}${CREDIT_DOCS_PATH}`,
    `- Migrate from Smithery: ${site}/migrate-from-smithery (French: ${site}/fr/migrer-depuis-smithery)`,
    `- Security: ${site}/security (French: ${site}/fr/securite)`,
    `- Guided setup: ${site}/demo (French: ${site}/fr/demo)`,
    `- Changelog: ${site}/changelog (French: ${site}/fr/changelog)`,
    `- Server catalogue: ${site}/servers (French: ${site}/fr/serveurs)`,
    `- Comparisons: ${site}/compare (French: ${site}/fr/comparer)`,
    `- Solutions (MCP packs per team): ${site}/solutions (French: ${site}/fr/solutions)`,
    `- Contact: hello@twinmcp.fr · security reports: security@twinmcp.fr`,
    "",
    "## Catalogue pages",
    ...SERVERS.map((s) => `- [${s.name}](${site}/servers/${s.slug}): ${s.tagline}`),
    "",
    "## Changelog",
    ...latest,
    "",
  ].join("\n");
}
