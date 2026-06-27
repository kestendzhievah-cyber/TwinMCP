import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "mcp-server-hosting";
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
    q: "What is the cheapest way to host an MCP server?",
    a: "Local stdio is free — the server runs as a child of your IDE on your own machine. The cheapest hosted option in 2026 is a serverless function on Cloudflare Workers (free tier covers most personal use). A small Docker VPS on Hetzner costs around $5 per month. Managed MCP runtimes start at $0 (TwinMCP free tier) and scale with usage.",
  },
  {
    q: "Can I run MCP servers in production without exposing them to the public internet?",
    a: "Yes. Self-hosted Docker on a private VPC, Cloudflare Tunnel, or a managed runtime with IP allowlisting all keep the server off the open internet. The client connects through your AI host (Cursor, Claude Code), and only the host needs network access to the server — your end users do not.",
  },
  {
    q: "Do MCP servers cost anything when nobody calls them?",
    a: "It depends on the hosting model. A VPS or always-on managed runtime accrues cost 24/7 even at zero traffic. Serverless functions and per-call managed tiers cost effectively zero when idle. Local stdio servers cost only the RAM they use while your IDE is running.",
  },
  {
    q: "Can multiple developers share the same MCP server instance?",
    a: "Only HTTP-transport servers can be shared. stdio servers run as a child of one host process, so each developer launching their IDE spawns their own copy. Sharing an HTTP MCP server across a team is one of the main reasons to move off stdio — central state, central logs, one place to rotate secrets.",
  },
  {
    q: "What happens if my MCP server goes down?",
    a: "The client surfaces a connection error to the host, which usually shows a red dot next to the server name and removes its tools from the model's catalog. The conversation keeps going — the model just loses access to the tools that server provided. No data loss, no cascading failure.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Five places make sense to run a Model Context Protocol server in
        2026: local stdio, a Docker container on your own VPS, a serverless function (Cloudflare
        Workers / Vercel / Lambda), an aggregator catalog like Smithery, or a managed MCP runtime.
        The right choice depends on whether you need persistence, whether the server holds secrets,
        whether multiple developers should share an instance, and how much operational time you want
        to spend. This guide compares them side by side, with real cost numbers and concrete
        decision criteria.
      </p>

      <h2 id="why-hosting-matters">Why hosting choice matters more than the spec lets on</h2>
      <p>
        Most introductions to MCP describe it as &ldquo;just JSON-RPC over stdio.&rdquo; That is
        technically true and operationally misleading. Where the server runs decides whether it can
        hold a database connection pool, whether it can keep secrets out of your laptop, whether it
        survives an IDE restart, and whether you can let someone else on your team use it without
        re-installing it. None of those questions are answered by the spec; all of them are answered
        by where you deploy.
      </p>
      <p>
        The protocol gives you two transports &mdash; stdio and HTTP &mdash; and that single bit
        cascades into every other operational decision. Pick stdio and you have chosen ephemeral,
        per-user, per-machine, zero-network. Pick HTTP and you have chosen long-lived, shared,
        networked, and you now own the deployment problem. Once you have committed to HTTP, the
        remaining question is just <em>which</em> kind of always-on host.
      </p>

      <h2 id="five-options">The five real options</h2>

      <h3>Option 1 &mdash; Local stdio (the default)</h3>
      <p>
        The server runs as a child process of your AI host. Cursor, Claude Desktop, Claude Code, and
        Windsurf all support this out of the box. You add a stanza to a config file with a command
        (typically <code>npx some-mcp-server</code>) and the host spawns the binary when it starts.
      </p>
      <p>
        Cost is zero. Setup time is two minutes. The trade-off is that the server is ephemeral,
        per-user, and per-machine. State lives in memory and dies with the host. Sharing the server
        with a teammate means convincing them to install it. Secrets come from the host&apos;s
        environment, so the GitHub token sitting in your shell is readable by every stdio server
        your IDE has loaded.
      </p>
      <p>
        Use stdio when the server is genuinely personal (filesystem access, shell, local
        scratchpad), when the work being done has no shared state, and when you trust the code
        enough to give it your laptop.
      </p>

      <h3>Option 2 &mdash; Self-hosted Docker on a VPS</h3>
      <p>
        You package the MCP server as a container, push it to a VPS (Hetzner, OVH, Digital Ocean,
        AWS Lightsail), expose port 443 behind a reverse proxy with TLS, and point your AI client at
        the URL with a bearer token. The HTTP transport handles the rest.
      </p>
      <p>
        Cost is predictable: a 2 vCPU / 4 GB Hetzner CX22 is around $5 per month and runs a dozen
        MCP servers comfortably. Setup time is a half-day the first time, an hour for each
        subsequent server. You own everything &mdash; isolation between servers, TLS renewal, log
        shipping, secret rotation, OS patches, certificate management, backups, monitoring,
        alerting.
      </p>
      <p>
        Use self-hosted when you have hard compliance requirements that force the server into your
        own VPC, when the integration is so specific to one company that no managed offering will
        ever sell it, or when running infrastructure is itself part of what your team does.
      </p>

      <h3>Option 3 &mdash; Serverless (Cloudflare Workers, Vercel, AWS Lambda)</h3>
      <p>
        Deploy the server as a serverless function. The HTTP entrypoint maps to a JSON-RPC handler.
        The function spins up on demand, handles the request, and terminates. Cloudflare Workers in
        particular have a generous free tier and global edge cold-starts under 50 ms.
      </p>
      <p>
        Cost at low volume is effectively zero. The trade-off is that serverless and long-lived MCP
        do not mix cleanly. The Server-Sent Events part of the transport wants a connection that
        stays open while the model thinks; stateless functions either kill it at the platform&apos;s
        timeout or charge for the wall-clock seconds. Local state (database connection pool,
        in-memory cache, in-progress workflows) is impossible by design.
      </p>
      <p>
        Use serverless when each tool call is short, stateless, and idempotent &mdash; a wrapper
        around an external API, a one-shot lookup, a translation. Avoid it when the server has its
        own database, holds long-lived sessions, or runs background work between requests.
      </p>

      <h3>Option 4 &mdash; Aggregator catalogs (Smithery, MCPHub)</h3>
      <p>
        A handful of services host the most popular open-source MCP servers on shared
        infrastructure. The catalog is curated, the servers are open source, and the platform
        handles all the operations. You connect Cursor or Claude Desktop to the catalog with a
        single token and pick which servers to enable.
      </p>
      <p>
        Cost is free for most use cases &mdash; the catalog operators monetize through affiliate
        fees, sponsored placements, or paid tiers for popular servers. Setup time is one click. The
        trade-off is that you cannot deploy your own private code &mdash; only published, often
        community-maintained, servers are available. Secrets you configure on the platform are
        visible to whoever runs it.
      </p>
      <p>
        Use catalogs when you want a one-tap install of GitHub, Notion, Slack, or other canonical
        MCPs and you do not care that the server is shared infrastructure.
      </p>

      <h3>
        Option 5 &mdash; Managed MCP runtimes (<Link href="/">TwinMCP</Link>, similar)
      </h3>
      <p>
        Managed runtimes provision an isolated sandbox per server. You point them at a package (npm,
        pip, Go module) or a Git repo, fill in the install and start commands, and you get a stable
        URL with a per-user API key. The platform handles isolation between servers, secret
        encryption, log capture, network egress policy, and IDE wiring snippets for Cursor, Claude
        Code, Windsurf, and Cline.
      </p>
      <p>
        Cost on TwinMCP starts at $0 for one server on the free tier and scales to a flat $20 per
        month for Pro (25 servers). Setup time is two minutes &mdash; pick a runtime, paste an
        install command, hit go. The trade-off is platform lock-in: the deployment configuration is
        platform-specific, and migrating off requires rebuilding the container yourself. (The MCP
        server code itself is portable; only the provisioning glue is not.)
      </p>
      <p>
        Use a managed runtime when the server holds secrets, when multiple developers should share
        it, when you want central logs and metrics, or when you do not have a platform team that
        wants to run your MCP infrastructure for you.
      </p>

      <h2 id="comparison">Comparison table</h2>
      <table>
        <thead>
          <tr>
            <th>Criterion</th>
            <th>Local stdio</th>
            <th>VPS Docker</th>
            <th>Serverless</th>
            <th>Catalog</th>
            <th>Managed</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Setup time</td>
            <td>2 min</td>
            <td>Half-day</td>
            <td>1 hour</td>
            <td>1 click</td>
            <td>2 min</td>
          </tr>
          <tr>
            <td>Cost at zero traffic</td>
            <td>$0</td>
            <td>$5&ndash;20/mo</td>
            <td>$0</td>
            <td>$0</td>
            <td>$0&ndash;20/mo</td>
          </tr>
          <tr>
            <td>Long-lived state</td>
            <td>Per-session</td>
            <td>Yes</td>
            <td>No</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Shared across users</td>
            <td>No</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Holds private secrets</td>
            <td>Risky</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>No</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Ops burden</td>
            <td>None</td>
            <td>High</td>
            <td>Medium</td>
            <td>None</td>
            <td>None</td>
          </tr>
          <tr>
            <td>Private code allowed</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>Yes</td>
            <td>No</td>
            <td>Yes</td>
          </tr>
        </tbody>
      </table>

      <h2 id="costs">Cost analysis with real numbers</h2>
      <p>
        Cost comparisons in vendor marketing are useless. Real numbers depend on real workloads.
        Here are three honest scenarios for an MCP server that wraps a Postgres database and exposes
        &ldquo;run query&rdquo; and &ldquo;describe schema&rdquo; tools.
      </p>
      <h3>Scenario A &mdash; one developer, occasional use</h3>
      <p>
        Ten tool calls per workday, each averaging 100 ms of compute. Local stdio: free. VPS Docker
        on Hetzner CX22: around $5 per month. Cloudflare Workers free tier: free (well under the
        100k requests/day limit). Smithery: free. TwinMCP free tier: free. The decision here is
        purely about features, not cost.
      </p>
      <h3>Scenario B &mdash; a team of ten, shared</h3>
      <p>
        Two hundred calls per workday across the team, each averaging 200 ms. Local stdio is not an
        option (no sharing). Hetzner CX22: around $5 per month (CPU and memory headroom is enormous
        at this volume). Cloudflare Workers: still under the free tier or about $5 on the paid plan.
        TwinMCP Team tier: $50 per month for unlimited servers and ten members. Smithery: free but
        does not host private code, so this scenario only works if your Postgres MCP is a public,
        generic one (which it is not, by definition).
      </p>
      <h3>Scenario C &mdash; production, customer-facing</h3>
      <p>
        Ten thousand calls per day, half of them with streaming responses. Hetzner: needs to scale
        to CPX31 (~$12/mo) and you are now managing real infrastructure. Cloudflare Workers: $5/mo
        plus paid SSE add-ons; awkward for streaming. TwinMCP Team: $50/mo flat. Self-hosted
        Kubernetes on AWS: $200&ndash;500/mo by the time you have HA, observability, and a runbook.
      </p>

      <h2 id="security">Security and isolation</h2>
      <p>Every hosting choice has a corresponding threat model. The honest summary:</p>
      <ul>
        <li>
          <strong>stdio</strong>: the server reads your entire shell environment. Every secret you
          have exported, every credential helper, every SSH agent socket. Treat the server as part
          of your local trust boundary.
        </li>
        <li>
          <strong>VPS Docker</strong>: as secure as your operational practices. The container is a
          soft boundary; a compromise of the server compromises everything on the same host unless
          you have configured user namespaces, AppArmor, and network segmentation.
        </li>
        <li>
          <strong>Serverless</strong>: strong process isolation by default. The trade-off is that
          secrets live in the platform&apos;s key management system, and that system becomes your
          blast radius.
        </li>
        <li>
          <strong>Catalogs</strong>: the operator can read your tokens. This is fine for read-only
          public APIs (GitHub fetch), unacceptable for write-scope credentials.
        </li>
        <li>
          <strong>Managed runtimes</strong>: per-server sandboxes (Upstash Box on TwinMCP,
          Firecracker microVMs elsewhere) give you hard isolation between servers. The platform
          operator can technically still see secrets at rest; the differentiator is how the
          operator&apos;s controls compare to your own VPS hygiene.
        </li>
      </ul>

      <h2 id="decision-tree">A decision tree that actually fits on screen</h2>
      <p>Start at the top, follow the first branch that matches:</p>
      <ol>
        <li>
          Is the server purely personal, with no secrets you cannot already trust your laptop with?{" "}
          <strong>Local stdio.</strong> Stop here.
        </li>
        <li>
          Do you have an operational team and a hard compliance reason to run inside your own VPC?{" "}
          <strong>Self-hosted Docker.</strong> Stop here.
        </li>
        <li>
          Is the server a thin wrapper around a stateless external API, with no streaming and no
          long-lived sessions? <strong>Serverless.</strong> Stop here.
        </li>
        <li>
          Are you just trying to use an existing open-source MCP without thinking about hosting?{" "}
          <strong>Catalog.</strong> Stop here.
        </li>
        <li>
          Anything else &mdash; shared team use, private code, secrets, persistence, or you just
          want this to work in two minutes? <strong>Managed runtime.</strong>
        </li>
      </ol>

      <h2 id="migration">Migration: how to move between options</h2>
      <p>
        The MCP server code itself is portable. The wrapper around it is not. If you start with
        stdio and outgrow it, the migration is mostly mechanical:
      </p>
      <ol>
        <li>
          Switch the server&apos;s transport from <code>StdioServerTransport</code> to{" "}
          <code>HttpServerTransport</code> (one line in the official SDKs).
        </li>
        <li>
          Externalize anything that read from process env or the local filesystem &mdash; move it to
          configuration that the new host can supply.
        </li>
        <li>
          Drop the binary into a container (or upload directly to a managed runtime that handles the
          container build for you).
        </li>
        <li>
          Update the IDE config: replace <code>{`{ "command": "npx ..." }`}</code> with{" "}
          <code>{`{ "url": "https://...", "transport": "http" }`}</code>.
        </li>
      </ol>
      <p>
        Going the other way (managed back to stdio) is rarer but works the same way. The protocol
        does not care.
      </p>

      <h2 id="conclusion">The pragmatic recommendation</h2>
      <p>
        If you are reading this post you are probably weighing two options: self-hosted because it
        sounds responsible, or a managed runtime because it sounds easy. The honest answer is that
        most teams overestimate the work of self-hosting and underestimate the cost of doing it
        well. Patching, log retention, secret rotation, TLS, isolation, on-call when something
        breaks &mdash; none of that scales linearly with the number of MCP servers you run.
      </p>
      <p>
        Start with a managed runtime (or stdio for personal projects). Move to self-hosted only when
        you can name the specific compliance or cost reason that forces the move. For background on
        the protocol itself, see our{" "}
        <Link href={"/blog/what-is-mcp" as Route}>complete guide to MCP</Link>. When you are ready
        to build your own server, the{" "}
        <Link href={"/blog/build-mcp-server" as Route}>step-by-step tutorial</Link> walks through
        the entire path from empty folder to a server running in Cursor.
      </p>
    </PostLayout>
  );
}
