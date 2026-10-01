import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "managed-vs-self-hosted-mcp";
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
    q: "Is managed MCP hosting more expensive than self-hosting?",
    a: "At a single server, self-hosting is slightly cheaper on paper. From roughly five servers up, the operational overhead of self-hosting (TLS, secrets, logs, monitoring, version churn) dominates and managed usually wins on total cost. The crossover depends on whether you already run infrastructure: if you operate Kubernetes today, adding MCP is nearly free; if you don't, the time cost is real.",
  },
  {
    q: "Can I move from managed to self-hosted later?",
    a: "Yes. An MCP server's code is portable — the lock-in is in the deployment glue, not the server. To self-host a server you ran on a managed platform, pull its install/start command and run the same npm/pip/Git package inside your own container with HTTP transport. The reverse is just as easy.",
  },
  {
    q: "Do I need Kubernetes to self-host MCP servers?",
    a: "No. Docker on a single VPS is enough to start. But you still own TLS termination, secret storage, log capture, process supervision, and updates. Kubernetes only becomes worth it once you're running many servers or need high availability — at which point you're operating real infrastructure.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Self-hosting an MCP server wins when you already operate
        infrastructure or have a hard compliance requirement. Managed hosting wins almost everywhere
        else, and the gap widens with every additional server. The decision is not about the MCP
        code &mdash; that is portable either way &mdash; it is about who runs the sandbox, the
        secrets, the TLS, and the logs.
      </p>

      <h2 id="definitions">What each one actually means</h2>
      <p>
        <strong>Self-hosted</strong> means you run the server process yourself: Docker on a VPS,
        Kubernetes, or a serverless function you deploy. You own the deployment configuration and
        everything around it &mdash; transport, TLS, secrets, monitoring, uptime.
      </p>
      <p>
        <strong>Managed</strong> means a platform runs the server for you. You provision it (pick a
        runtime, install an MCP or point at your package), and the platform handles the sandbox,
        secret encryption, the public endpoint, and the logs. A managed runtime like{" "}
        <Link href="/">TwinMCP</Link> gives each server its own isolated sandbox and a single proxy
        URL + key that works across Cursor, Claude Code, Windsurf, and Cline.
      </p>

      <h2 id="cost">The real cost curve</h2>
      <p>
        This is where most comparisons go wrong, because they only count the server bill. The honest
        version counts <em>time</em> too.
      </p>
      <ul>
        <li>
          <strong>At one server,</strong> a small VPS is a few euros a month and self-hosting looks
          cheaper than any managed plan. For a single hobby server, it often is.
        </li>
        <li>
          <strong>At five servers and up,</strong> the per-server bill stops mattering and the
          operational overhead takes over: certificate renewal, secret rotation, log shipping,
          watching for the version that silently broke. That overhead is flat work you pay whether
          you have one server or ten &mdash; and it is exactly what a managed plan absorbs.
        </li>
      </ul>
      <p>
        The crossover is not a fixed number of servers; it is a function of whether you already run
        infrastructure. If you operate a cluster today, MCP is a rounding error and self-hosting
        stays cheap. If you don&apos;t, standing up the operations for even a couple of servers is
        more work than it looks. For the serverless-specific numbers, see{" "}
        <Link href={"/blog/upstash-box-vs-cloudflare-workers" as Route}>
          Upstash Box vs Cloudflare Workers
        </Link>
        .
      </p>

      <h2 id="ops">The ops you actually sign up for</h2>
      <p>
        Running an MCP server <em>well</em> &mdash; not just getting a process to respond once
        &mdash; means owning all of this when you self-host:
      </p>
      <ul>
        <li>
          <strong>Sandboxing:</strong> an MCP server executes tool calls that touch real systems; it
          needs isolation from everything else you run.
        </li>
        <li>
          <strong>Secrets:</strong> encrypted at rest, rotated, never leaked into logs or the shell
          environment.
        </li>
        <li>
          <strong>Transport &amp; TLS:</strong> a stable HTTPS endpoint, and correct handling of
          MCP&apos;s long-lived streaming (SSE) connections.
        </li>
        <li>
          <strong>Observability:</strong> request logs, error capture, and metrics &mdash; because
          the AI client hides most failures from you (see{" "}
          <Link href={"/blog/mcp-server-monitoring" as Route}>MCP server monitoring</Link>).
        </li>
        <li>
          <strong>Lifecycle:</strong> restarts, updates, and running several versions in parallel
          without downtime.
        </li>
      </ul>
      <p>
        A managed runtime does all of that as the product. Self-hosting means it is your checklist.
      </p>

      <h2 id="security">Security and isolation</h2>
      <p>
        Both models can be secure; they put the responsibility in different places. Self-hosting
        gives you full control of the network boundary &mdash; the server can live entirely inside
        your VPC, which is sometimes a hard requirement. The flip side is that every isolation and
        encryption guarantee is one <em>you</em> have to implement and keep working.
      </p>
      <p>
        A good managed runtime makes isolation the default: a separate sandbox per server, secrets
        encrypted per-server, a dedicated key per server, and audit logs out of the box. The
        boundary is the platform&apos;s instead of your network &mdash; which is the right trade for
        most teams, and the wrong one for a few with strict data-residency rules.
      </p>

      <h2 id="scaling">Scaling and reliability</h2>
      <p>
        Self-hosting scales exactly as far as your ops maturity. Adding the tenth server, surviving
        a node failure, or rolling an update without dropping live SSE connections are all solvable
        &mdash; they are just work you own. Managed platforms fold that into the plan: you provision
        another server and the capacity, isolation, and routing come with it.
      </p>

      <h2 id="when-each">When each one wins</h2>
      <p>
        <strong>Self-host</strong> when one of three things is true: a compliance rule forces the
        server into your own network, you already operate enough infrastructure that MCP is free, or
        you specifically want the protocol-level visibility that running it yourself gives you.
      </p>
      <p>
        <strong>Go managed</strong> when you want MCP servers running today without owning the
        sandbox, the TLS, the secrets, and the monitoring &mdash; which is most teams, most of the
        time. It is also the faster path to private, team-shared servers: provision, install, share
        one URL and key.
      </p>

      <h2 id="migration">Migration goes both ways</h2>
      <p>
        Lock-in kills more decisions than it should, so it is worth stating plainly: an MCP
        server&apos;s code is portable across every option. The deployment configuration is the only
        platform-specific part. Start managed to move fast, and you can lift a server into your own
        container later by running the same package with HTTP transport; start self-hosted and you
        can point a managed runtime at the same npm/pip package or Git repo. Pick for where you are
        now, not for fear of where you might go.
      </p>

      <h2 id="next">Where to go next</h2>
      <p>
        For the full hosting matrix including catalogs and serverless, read{" "}
        <Link href={"/blog/mcp-server-hosting" as Route}>MCP server hosting in 2026</Link>. If
        you&apos;re weighing a public catalog against running your own, see{" "}
        <Link href={"/blog/smithery-vs-twinmcp" as Route}>Smithery vs TwinMCP vs self-host</Link>{" "}
        and the{" "}
        <Link href={"/blog/smithery-alternatives" as Route}>best Smithery alternatives</Link>. To
        try the managed route, the <Link href={"/plans" as Route}>free tier</Link> gives you one
        isolated server and the full <Link href={"/servers" as Route}>MCP catalog</Link> in a couple
        of minutes.
      </p>
    </PostLayout>
  );
}
