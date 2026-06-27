import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "cursor-mcp-setup";
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
    q: "Where is the Cursor MCP config file located?",
    a: "On macOS and Linux, ~/.cursor/mcp.json for global config, or .cursor/mcp.json in the project root for per-project servers. On Windows, %USERPROFILE%\\.cursor\\mcp.json. Cursor reads both and merges them.",
  },
  {
    q: "Why does my MCP server show a red dot in Cursor?",
    a: "Three usual causes: a stray console.log corrupting stdio, an absolute path that no longer exists, or missing environment variables the server expects. Check the MCP panel logs — Cursor shows the exact failure message in the server's dropdown.",
  },
  {
    q: "Can I use HTTP MCP servers in Cursor?",
    a: "Yes. Use the url field instead of command. Cursor opens a streaming HTTP connection (or legacy SSE for older servers) and authenticates with the Authorization header you configure. This is what you need when the server is hosted (Upstash Box, Cloudflare, TwinMCP) rather than running locally.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Cursor reads MCP servers from <code>~/.cursor/mcp.json</code>
        (global) and <code>.cursor/mcp.json</code> (per-project). Add a server with a command
        (stdio) or a URL (HTTP), restart Cursor, and the tools appear in the model catalog. This
        guide covers the exact config format, every common error, and how to keep API keys out of
        your repo.
      </p>

      <h2 id="config-file">Where the config lives</h2>
      <p>
        Cursor uses two locations and merges them at startup. The global file at{" "}
        <code>~/.cursor/mcp.json</code> (or <code>%USERPROFILE%\.cursor\mcp.json</code> on Windows)
        defines servers that follow you across every project. The per-project file at{" "}
        <code>.cursor/mcp.json</code> at the root of any workspace defines servers scoped to that
        project &mdash; useful when you want a Postgres MCP pointing at the project&apos;s dev
        database without polluting your global config.
      </p>
      <p>
        Per-project beats global on name collisions. If you have a <code>github</code> server in
        both, the project-level one wins inside that workspace. Both files share the same JSON
        schema.
      </p>

      <h2 id="stdio">Adding a stdio server</h2>
      <p>
        stdio is the default for local development. Cursor spawns the server as a child process,
        talks JSON-RPC over its stdin and stdout, and tears it down when you close the workspace.
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Documents"]
    },
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}`}</code>
      </pre>
      <p>
        Note on the GitHub example: the original <code>@modelcontextprotocol/server-github</code>{" "}
        npm package has been deprecated in favor of GitHub&apos;s own server, distributed as a Go
        binary / Docker image at <code>ghcr.io/github/github-mcp-server</code>.
      </p>
      <p>
        Three fields matter: <code>command</code> is the binary or script to run, <code>args</code>{" "}
        is the array passed to it, <code>env</code> is the environment the server inherits. Cursor
        does <strong>not</strong> use your shell, so anything in <code>.zshrc</code> or{" "}
        <code>.bashrc</code> is invisible &mdash; secrets have to live in <code>env</code>.
      </p>

      <h2 id="http">Adding an HTTP server</h2>
      <p>
        HTTP transport is for hosted MCPs &mdash; a server running on Upstash Box, Cloudflare
        Workers, your own VPS, or a managed runtime like <Link href="/">TwinMCP</Link>. The config
        is simpler:
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "weather-prod": {
      "url": "https://weather.mcp.twinmcp.fr/sse",
      "headers": {
        "Authorization": "Bearer tw_live_..."
      }
    }
  }
}`}</code>
      </pre>
      <p>
        The URL points at the server&apos;s HTTP endpoint &mdash; <code>/mcp</code> for the newer
        streamable-HTTP transport, or <code>/sse</code> for the legacy SSE-based servers. The
        headers are sent on every request &mdash; this is where the bearer token goes. Cursor
        respects standard HTTP semantics: 401 invalidates the connection, 429 triggers backoff, 5xx
        surfaces as a red dot in the panel.
      </p>

      <h2 id="secrets">Keeping secrets out of the repo</h2>
      <p>
        The most common mistake is committing <code>.cursor/mcp.json</code> with a real API token
        inside. Three ways to avoid it.
      </p>
      <p>
        <strong>Option 1 &mdash; gitignore the file.</strong> Add <code>.cursor/mcp.json</code> to{" "}
        <code>.gitignore</code> and document the required config in your project README. Simple,
        works, opaque to onboarding.
      </p>
      <p>
        <strong>Option 2 &mdash; reference env vars.</strong> Cursor expands{" "}
        <code>{`${"$"}{ENV_VAR}`}</code> syntax in the <code>env</code> block and headers. Set the
        variable in your shell <em>before</em> launching Cursor (Cursor inherits its environment
        from however you launched it). On macOS, launching Cursor from the dock means your shell
        exports do not apply &mdash; use a launcher script or set the var system-wide.
      </p>
      <p>
        <strong>Option 3 &mdash; use a hosted MCP.</strong> Managed runtimes keep the secret
        server-side; Cursor only sees a bearer token scoped to your user. Rotating keys is one click
        in the dashboard instead of a config-file edit.
      </p>

      <h2 id="troubleshooting">Common errors and fixes</h2>
      <p>
        <strong>Red dot, no tools, no obvious error.</strong> Open the server&apos;s dropdown in the
        MCP panel and check the captured stderr. Nine times out of ten the server crashed during
        startup because <code>npx</code> failed to install (no network, package renamed) or a
        required env var was missing.
      </p>
      <p>
        <strong>Tools appear briefly then disappear.</strong> The server is exiting between
        requests. This happens when an stdio server&apos;s main loop has a fatal exception that the
        SDK does not catch. Add a global <code>process.on(&apos;uncaughtException&apos;)</code>{" "}
        handler in the server and re-run.
      </p>
      <p>
        <strong>&ldquo;Tool exists but produces invalid output.&rdquo;</strong> Almost always a{" "}
        <code>console.log</code> mixed into stdout. Audit the server source for any non-error
        logging and route it to <code>console.error</code>. If the server is not yours, file an
        issue.
      </p>
      <p>
        <strong>401 on HTTP transport.</strong> Cursor sends the Authorization header exactly as you
        wrote it, no auto-prefix. If your server expects <code>Bearer xyz</code>, write the whole
        string in <code>headers</code>, not just the token.
      </p>

      <h2 id="next">Where to go next</h2>
      <p>
        If you need MCPs that work day-one, browse our{" "}
        <Link href={"/blog/production-mcp-servers" as Route}>
          curated list of 10 production-ready MCP servers
        </Link>
        . If you want to build your own, the{" "}
        <Link href={"/blog/build-mcp-server" as Route}>step-by-step tutorial</Link> walks through a
        complete server. If you want someone else to host them for you,{" "}
        <Link href="/">TwinMCP&apos;s free tier</Link> takes you from sign-up to a working Cursor
        connection in two minutes.
      </p>
    </PostLayout>
  );
}
