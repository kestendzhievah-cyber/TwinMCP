import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "mcp-server-monitoring";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

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
    q: "Will an MCP server's stdout logs appear in my IDE?",
    a: "No, and you should not log to stdout from a stdio server — that channel carries the protocol. Use stderr for logs. The IDE typically captures stderr per server in its MCP panel.",
  },
  {
    q: "What metric matters most for an MCP server?",
    a: "Tool-call success rate by tool name. Aggregate numbers hide the one broken tool that the model has stopped trying to use. Slice by tool first, then by token or user.",
  },
  {
    q: "Can I trace AI tool calls end-to-end across the MCP boundary?",
    a: "Yes, with OpenTelemetry. Propagate traceparent in the request metadata (custom MCP extension) so the client's trace ID matches the server's, and you can follow a single user prompt through the model to the tool call to the upstream API and back.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> MCP servers fail in ways that are easy to miss: a tool starts
        erroring, the AI client silently drops it from the model&apos;s catalog, and you find out a
        week later when a user complains. This post covers what to log, which metrics are worth
        collecting, how to ship them to Datadog / Grafana / Axiom, and the failure modes you only
        catch with proper observability.
      </p>

      <h2 id="what-to-log">What to log (and where)</h2>
      <p>Three log streams matter. Keep them separate:</p>
      <ul>
        <li>
          <strong>Request log</strong> &mdash; one structured entry per JSON-RPC call. Fields: tool
          name, request id, token hash (never the raw token), duration, status, error code if any.
          This is the workhorse log.
        </li>
        <li>
          <strong>Error log</strong> &mdash; every uncaught exception, every 5xx from upstream APIs,
          every Zod validation failure. Stack trace included.
        </li>
        <li>
          <strong>Audit log</strong> &mdash; only writes. Tool name, who triggered it, arguments
          (after redaction), result. Useful for both compliance and post-incident reconstruction.
        </li>
      </ul>
      <p>
        Send all three as JSON to stderr (stdio transport) or to your log aggregator directly (HTTP
        transport). The JSON shape lets you query them in Datadog Logs, Loki, or Axiom without
        parsing.
      </p>

      <h2 id="structured">Structured logging template</h2>
      <pre>
        <code>{`function log(level: "info" | "warn" | "error", event: string, fields: object) {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    server: "weather",
    ...fields,
  }));
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const t0 = Date.now();
  const tool = req.params.name;
  try {
    const result = await dispatch(tool, req.params.arguments);
    log("info", "tool_call", {
      tool,
      status: "ok",
      duration_ms: Date.now() - t0,
    });
    return result;
  } catch (err) {
    log("error", "tool_call", {
      tool,
      status: "error",
      duration_ms: Date.now() - t0,
      error: (err as Error).message,
    });
    throw err;
  }
});`}</code>
      </pre>
      <p>
        That ~15 lines is enough infrastructure to debug 90% of MCP-server incidents. Avoid the
        temptation to log inputs unfiltered &mdash; tool arguments often include user content that
        you do not want in long-term storage.
      </p>

      <h2 id="metrics">The four metrics worth tracking</h2>
      <p>Prometheus naming conventions make these portable across Grafana, Datadog, and Axiom:</p>
      <ul>
        <li>
          <strong>mcp_tool_calls_total</strong> (counter, labels: tool, status) &mdash; how often
          each tool is invoked, success vs error. The single most useful chart you will build.
        </li>
        <li>
          <strong>mcp_tool_call_duration_seconds</strong> (histogram, labels: tool) &mdash; latency
          distribution per tool. Watch p95 and p99, not just average.
        </li>
        <li>
          <strong>mcp_active_connections</strong> (gauge) &mdash; open SSE connections on HTTP
          transport. Spikes here precede memory pressure.
        </li>
        <li>
          <strong>mcp_upstream_errors_total</strong> (counter, labels: upstream, code) &mdash;
          failures from whatever your tools wrap (GitHub, Postgres, etc.). The early-warning signal
          for &ldquo;the model thinks the tool is broken.&rdquo;
        </li>
      </ul>

      <h2 id="exporters">Shipping the metrics</h2>
      <p>Three reasonable paths depending on your stack.</p>
      <p>
        <strong>OpenTelemetry &mdash; the portable path.</strong> Wrap your handlers in OTel manual
        instrumentation, point the exporter at any OTLP-compatible backend (Datadog, Honeycomb,
        Grafana Cloud, Axiom, Jaeger). One config, swap backends without rewriting code.
      </p>
      <p>
        <strong>Vendor SDK &mdash; the fast path.</strong> If you have already committed to Datadog,
        the <code>dd-trace</code> Node SDK auto-instruments Express and adds tracing. Add a custom
        span per tool call and you are done.
      </p>
      <p>
        <strong>Log-only &mdash; the pragmatic path.</strong> Push structured JSON logs to Axiom or
        Loki and derive metrics from them with queries. Saves you the instrumentation step. Loses
        fine-grained latency histograms.
      </p>

      <h2 id="errors">Error tracking: Sentry for MCP</h2>
      <p>
        Sentry catches unhandled exceptions in a way structured logs do not &mdash; it groups by
        stack trace, deduplicates, and sends alerts. Two lines of setup:
      </p>
      <pre>
        <code>{`import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });

process.on("uncaughtException", (e) => Sentry.captureException(e));
process.on("unhandledRejection", (e) => Sentry.captureException(e));`}</code>
      </pre>
      <p>
        Wrap tool handlers in <code>try/catch</code> and call <code>Sentry.captureException</code>{" "}
        in the catch arm with the tool name as a tag. The grouped error view will surface broken
        tools instantly.
      </p>

      <h2 id="hidden">The failures you only see with monitoring</h2>
      <p>
        The single most insidious MCP failure: the AI host drops a tool from the model&apos;s
        catalog after repeated errors and never re-tries. The model silently stops using it. Your
        users see &ldquo;the AI forgot how to query the database&rdquo; without any error in their
        conversation. Three signals that catch this:
      </p>
      <ul>
        <li>
          A sustained drop in <code>mcp_tool_calls_total</code> for a specific tool &mdash; alert on
          a 1-hour window when the rate falls below 20% of the prior 24-hour baseline.
        </li>
        <li>
          Error rate above 10% per tool, sliding window &mdash; pages before the host gives up on
          the tool.
        </li>
        <li>
          Upstream API errors that the tool absorbs &mdash; the model never sees the 5xx, but{" "}
          <code>mcp_upstream_errors_total</code> records every one.
        </li>
      </ul>

      <h2 id="next">Where to go next</h2>
      <p>
        For the broader operational picture (sandboxing, secret rotation, network policy), see{" "}
        <Link href={"/blog/secure-mcp-server" as Route}>securing your MCP server</Link>. For
        deployment options that include logs and metrics as defaults,{" "}
        <Link href={"/blog/mcp-server-hosting" as Route}>MCP server hosting in 2026</Link> compares
        the alternatives. And if you would rather skip the wiring and use a runtime that ships
        dashboards with the server, <Link href="/">TwinMCP</Link> captures these metrics out of the
        box on every tier.
      </p>
    </PostLayout>
  );
}
