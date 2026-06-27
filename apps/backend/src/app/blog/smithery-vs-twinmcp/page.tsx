import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "smithery-vs-twinmcp";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: { canonical: `/blog/${SLUG}` },
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
    q: "Can I install private MCP servers on Smithery?",
    a: "Smithery's core proposition is its catalog of public, open-source MCPs. Private hosting options have expanded on paid tiers — check Smithery's current pricing — but the platform's main draw remains the public registry. For purely private code with strict secret-isolation guarantees, a managed runtime like TwinMCP or self-hosting is usually a cleaner fit.",
  },
  {
    q: "Does TwinMCP let me run open-source MCPs from the catalog too?",
    a: "Yes. TwinMCP ships an installable catalog of the popular open-source MCPs (the official Anthropic servers plus a curated set) and lets you publish your own private MCPs alongside them. The free tier includes the catalog access.",
  },
  {
    q: "How does self-hosting compare on operational cost?",
    a: "At one server it's slightly cheaper than managed; at five servers and above, the operational overhead dominates and managed catches up. The crossover depends on your team — if you already run Kubernetes, adding MCP is a rounding error. If you don't, the time cost of standing up the operations is real.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Smithery, TwinMCP, and self-hosting are the three serious options
        for running MCP servers in 2026. They are not direct competitors &mdash; each wins a
        different shape of use case. Smithery is a public catalog of open MCPs. TwinMCP is a managed
        runtime where you provision your own (public or private). Self-hosting is
        everything-yourself. This post compares them on the six criteria that actually matter.
      </p>

      <h2 id="what-they-are">What each one actually is</h2>
      <p>
        <strong>Smithery</strong> is primarily a hosted catalog. The team curates a large registry
        of open-source MCPs (several thousand at the time of writing), runs the popular ones on
        shared infrastructure, and gives you a single token to connect from Cursor or Claude
        Desktop. Smithery has expanded its paid tiers over time &mdash; check their current pricing
        for the latest private-hosting options &mdash; but the catalog remains the platform&apos;s
        core value proposition.
      </p>
      <p>
        <strong>TwinMCP</strong> is a managed runtime plus a catalog. Each server you create gets
        its own isolated sandbox (Upstash Box micro-VM). The catalog of popular MCPs is one-click
        installable; private MCPs are deployable from a package or Git repo. Secrets are encrypted
        per-server and never shared.
      </p>
      <p>
        <strong>Self-hosting</strong> is everything else: Docker on a VPS, Kubernetes, serverless
        functions. You write the deployment glue, you operate it, you own the ops.
      </p>

      <h2 id="comparison">Comparison on six criteria</h2>
      <table>
        <thead>
          <tr>
            <th>Criterion</th>
            <th>Smithery</th>
            <th>TwinMCP</th>
            <th>Self-host</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Setup time</td>
            <td>1 click</td>
            <td>2 min</td>
            <td>Half-day</td>
          </tr>
          <tr>
            <td>Open-source MCPs</td>
            <td>Yes (catalog)</td>
            <td>Yes (catalog)</td>
            <td>Yes (manual)</td>
          </tr>
          <tr>
            <td>Private MCPs</td>
            <td>No</td>
            <td>Yes (Pro+)</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Per-server isolation</td>
            <td>Shared</td>
            <td>Per-user sandbox</td>
            <td>Your call</td>
          </tr>
          <tr>
            <td>Secret encryption at rest</td>
            <td>Platform-managed</td>
            <td>Per-server, AES-256-GCM</td>
            <td>Your call</td>
          </tr>
          <tr>
            <td>Ops burden</td>
            <td>None</td>
            <td>None</td>
            <td>High</td>
          </tr>
          <tr>
            <td>Free tier</td>
            <td>Yes (full catalog)</td>
            <td>1 server, full catalog</td>
            <td>$0 software, time cost</td>
          </tr>
        </tbody>
      </table>

      <h2 id="when-smithery">When Smithery wins</h2>
      <p>
        Smithery is the right choice when every MCP you need is public and open source, and you do
        not care that the server is shared infrastructure. Three concrete scenarios:
      </p>
      <ul>
        <li>
          You want GitHub + Slack + Notion in Cursor today, with one token, with no deployment.
        </li>
        <li>
          You are evaluating MCP and want to feel what well-known servers actually do before
          deciding whether to invest.
        </li>
        <li>
          You contribute to an open-source MCP and want a stable URL to point users at without
          operating anything yourself.
        </li>
      </ul>
      <p>
        Where it stops working: anything that holds your credentials with write access (the operator
        can read them), anything you wrote yourself (the catalog does not host private code),
        anything that needs team-level access controls.
      </p>

      <h2 id="when-twinmcp">When TwinMCP wins</h2>
      <p>
        TwinMCP is the right choice when you need at least one MCP that is not in the public catalog
        &mdash; an internal API wrapper, a custom RAG server, a company-specific tool &mdash; or
        when you need real isolation between servers that hold different secrets.
      </p>
      <ul>
        <li>
          You publish a private MCP for your team and want it usable from Cursor without everyone
          running it locally.
        </li>
        <li>
          You operate multiple MCPs with different blast radii (read-only Postgres, write-scope
          GitHub, internal admin tool) and want them in separate sandboxes.
        </li>
        <li>You need audit logs and key rotation as first-class features, not afterthoughts.</li>
      </ul>
      <p>
        Where it stops being the obvious choice: when your existing platform team already runs
        everything else, and adding MCP is genuinely just another container in the cluster.
      </p>

      <h2 id="when-selfhost">When self-hosting wins</h2>
      <p>
        Self-hosting is right when one of three things is true: you have a hard compliance
        requirement that forces the server into your own VPC, you already operate enough
        infrastructure that adding MCP is free, or you specifically want the visibility into the
        protocol that running it yourself provides.
      </p>
      <p>
        Outside of those, self-hosting under-delivers on the value proposition. Operating an MCP
        server well requires sandboxing, log capture, secret rotation, TLS, monitoring, and the
        ability to handle a dozen versions in parallel. Doing all that for one MCP is more work than
        running the rest of your platform.
      </p>

      <h2 id="migration">Migration is easy in any direction</h2>
      <p>
        Worth knowing because lock-in concerns kill more decisions than they should. An MCP
        server&apos;s code is portable across all three options. The lock-in is in the deployment
        configuration, not the server itself.
      </p>
      <ul>
        <li>
          <strong>Smithery &rarr; TwinMCP</strong>: install the same upstream package into a TwinMCP
          server, copy your secrets.
        </li>
        <li>
          <strong>TwinMCP &rarr; self-host</strong>: pull the install command, run it inside your
          own container with HTTP transport.
        </li>
        <li>
          <strong>Self-host &rarr; TwinMCP</strong>: point TwinMCP at the same npm/pip package or
          Git repo, paste the install/start commands.
        </li>
      </ul>

      <h2 id="next">Where to go next</h2>
      <p>
        For the full hosting matrix including serverless and local stdio, see{" "}
        <Link href={"/blog/mcp-server-hosting" as Route}>MCP server hosting in 2026</Link>. For the
        deeper infra comparison if you have already decided to go managed rather than catalog, read{" "}
        <Link href={"/blog/upstash-box-vs-cloudflare-workers" as Route}>
          Upstash Box vs Cloudflare Workers
        </Link>
        . And to start on the TwinMCP side without committing, <Link href="/">the free tier</Link>{" "}
        gives you one server and the full catalog.
      </p>
    </PostLayout>
  );
}
