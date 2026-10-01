import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "smithery-alternatives";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: `/blog/${SLUG}`,
    languages: {
      en: `/blog/${SLUG}`,
      fr: `/fr/blog/${SLUG}`,
      "x-default": `/blog/${SLUG}`,
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${SLUG}`,
    publishedTime: post.publishedAt,
  },
};

const faq = [
  {
    q: "What is the best Smithery alternative for private MCP servers?",
    a: "A managed MCP runtime like TwinMCP, or self-hosting. Smithery's strength is its public, open-source catalog; it is not built to host your own private code with per-server secret isolation. A managed runtime gives you an isolated sandbox per server plus a one-click catalog, while self-hosting gives you full control at the cost of operating it yourself.",
  },
  {
    q: "Is there a free Smithery alternative?",
    a: "Yes. TwinMCP has a free tier with one isolated server and full catalog access, no credit card. Self-hosting is free in software but costs real time to operate (TLS, secrets, logs, monitoring). Other public registries also have free catalog tiers with trade-offs similar to Smithery's.",
  },
  {
    q: "Can I migrate off Smithery easily?",
    a: "Yes — an MCP server's code is portable. The lock-in is in the deployment configuration, not the server itself. To move to a managed runtime or your own host, install the same upstream package (npm/pip/Git), paste the start command, and copy your secrets over.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> <Link href={"/blog/smithery-vs-twinmcp" as Route}>Smithery</Link> is
        an excellent choice when every MCP you need is public and open source and you are fine
        running on shared infrastructure. The moment you need <em>private code</em>, real{" "}
        <em>isolation</em>, per-server <em>secrets</em>, or <em>team access controls</em>, you want
        a different tool. This guide covers the four kinds of Smithery alternative &mdash; managed
        runtimes, other public registries, self-hosting, and serverless &mdash; and how to pick.
      </p>

      <h2 id="why-alternative">Why people look for a Smithery alternative</h2>
      <p>
        Smithery&apos;s core proposition is a hosted catalog of public, open-source MCPs: the team
        curates a large registry, runs the popular servers on shared infrastructure, and gives you a
        single token to connect from Cursor or Claude Desktop. That is genuinely useful &mdash; but
        it defines the ceiling people run into:
      </p>
      <ul>
        <li>
          <strong>Private code.</strong> A public catalog hosts public servers. The internal API
          wrapper you wrote, your custom RAG server, a company-specific tool &mdash; those do not
          belong in a shared registry.
        </li>
        <li>
          <strong>Credential blast radius.</strong> A server on shared infrastructure that holds a
          write-scoped GitHub token or a database connection string is only as isolated as the
          platform makes it. For anything with real write access, you usually want a sandbox that is
          yours.
        </li>
        <li>
          <strong>Team controls.</strong> Per-user keys, audit logs, and key rotation are
          first-class needs the moment more than one person is involved.
        </li>
      </ul>
      <p>
        If none of those apply to you, Smithery is probably fine &mdash; see the direct{" "}
        <Link href={"/blog/smithery-vs-twinmcp" as Route}>Smithery vs TwinMCP vs self-host</Link>{" "}
        breakdown. If one of them does, here are the alternatives.
      </p>

      <h2 id="criteria">What to look for in an alternative</h2>
      <p>Judge every option on the six criteria that actually change the decision:</p>
      <ul>
        <li>
          <strong>Private MCPs</strong> &mdash; can you run code that is not in a public catalog?
        </li>
        <li>
          <strong>Isolation</strong> &mdash; is each server its own sandbox, or shared?
        </li>
        <li>
          <strong>Secret handling</strong> &mdash; encrypted at rest, per-server, never exposed to
          other tenants?
        </li>
        <li>
          <strong>Client compatibility</strong> &mdash; does one URL + key work across Cursor,
          Claude, Windsurf, and Cline?
        </li>
        <li>
          <strong>Pricing model</strong> &mdash; free tier, flat, or usage-based?
        </li>
        <li>
          <strong>Lock-in</strong> &mdash; how hard is it to leave?
        </li>
      </ul>

      <h2 id="managed">1. Managed MCP runtimes &mdash; the closest alternative</h2>
      <p>
        A managed runtime is the natural step up from a catalog: instead of connecting to a shared
        public server, you <em>provision your own</em> &mdash; public or private &mdash; and the
        platform runs it for you. <Link href="/">TwinMCP</Link> is built around exactly this. Each
        server you create gets its own isolated sandbox (an Upstash Box micro-VM). The catalog of
        popular open-source MCPs is one-click installable, and you can publish your own private MCPs
        from a package or Git repo alongside them. Secrets are encrypted per-server (AES-256-GCM)
        and never shared between tenants, and a single proxy URL + key works across Cursor, Claude
        Code, Windsurf, and Cline.
      </p>
      <p>
        It keeps what makes Smithery pleasant &mdash; no deployment, one token, an installable
        catalog &mdash; and removes the ceiling: private code, per-server isolation, audit logs, and
        key rotation as first-class features. The <Link href={"/plans" as Route}>free tier</Link>{" "}
        gives you one server and the full catalog with no credit card, so the swap costs nothing to
        try.
      </p>

      <h2 id="registries">2. Other public registries and directories</h2>
      <p>
        If all you want is a <em>different</em> public catalog &mdash; not a new capability &mdash;
        there are other MCP registries and directories in the ecosystem (for example Glama,
        PulseMCP, and mcp.run). They broadly share Smithery&apos;s shape: a browsable index of
        public, open-source servers, with the convenience and the limits that come with it. Always
        check a given registry&apos;s current docs for private-hosting and isolation options, since
        these evolve quickly.
      </p>
      <p>
        The honest summary: switching from one public registry to another changes the catalog and
        the UX, not the fundamental trade-off. If your blocker was &ldquo;I need to run private code
        with real isolation,&rdquo; another registry will hit the same ceiling &mdash; you want a
        managed runtime or self-hosting instead.
      </p>

      <h2 id="selfhost">3. Self-hosting (Docker or Kubernetes)</h2>
      <p>
        Self-hosting is the maximum-control alternative: Docker on a VPS, or Kubernetes if you
        already run it. You get private code, whatever isolation you design, and your own VPC
        &mdash; which matters if you have a hard compliance requirement. The cost is that you own
        the ops: sandboxing, TLS, secret rotation, log capture, monitoring, and running several
        versions in parallel.
      </p>
      <p>
        It is the right call when you already operate enough infrastructure that adding MCP is a
        rounding error, or when a policy forces the server into your own network. Outside of those,
        doing all of that well for one or two MCPs is usually more work than it saves &mdash; the
        full math is in{" "}
        <Link href={"/blog/managed-vs-self-hosted-mcp" as Route}>managed vs self-hosted MCP</Link>.
      </p>

      <h2 id="serverless">4. Serverless (Cloudflare Workers, Upstash Box)</h2>
      <p>
        If you are hosting one or two servers yourself and want to skip VM management, serverless
        platforms can run MCP servers directly. The nuance is that MCP&apos;s streaming transport
        (long-lived SSE) and cold starts behave differently across providers. The head-to-head is in{" "}
        <Link href={"/blog/upstash-box-vs-cloudflare-workers" as Route}>
          Upstash Box vs Cloudflare Workers
        </Link>
        . A managed runtime abstracts this away; rolling it yourself gives you more control and more
        to operate.
      </p>

      <h2 id="choose">How to choose, in one table</h2>
      <table>
        <thead>
          <tr>
            <th>Need</th>
            <th>Best fit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Only public, open-source MCPs, zero ops</td>
            <td>Smithery (or another public registry)</td>
          </tr>
          <tr>
            <td>Private code + isolation, still no ops</td>
            <td>Managed runtime (TwinMCP)</td>
          </tr>
          <tr>
            <td>Hard compliance / own VPC</td>
            <td>Self-host</td>
          </tr>
          <tr>
            <td>One or two servers, no VM management</td>
            <td>Serverless</td>
          </tr>
          <tr>
            <td>Team keys, audit logs, rotation</td>
            <td>Managed runtime or self-host</td>
          </tr>
        </tbody>
      </table>

      <h2 id="next">Where to go next</h2>
      <p>
        For the full hosting matrix &mdash; local stdio, VPS, serverless, catalogs, managed &mdash;
        read <Link href={"/blog/mcp-server-hosting" as Route}>MCP server hosting in 2026</Link>. For
        the direct head-to-head, see{" "}
        <Link href={"/blog/smithery-vs-twinmcp" as Route}>Smithery vs TwinMCP vs self-host</Link>.
        And to try the managed route without committing, the{" "}
        <Link href={"/servers" as Route}>MCP catalog</Link> and the <Link href="/">free tier</Link>{" "}
        give you one isolated server and every popular MCP in a few minutes.
      </p>
    </PostLayout>
  );
}
