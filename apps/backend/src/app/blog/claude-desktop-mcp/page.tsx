import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "claude-desktop-mcp";
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
    q: "Where is Claude Desktop's MCP config file?",
    a: "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. Windows: %APPDATA%\\Claude\\claude_desktop_config.json. The file may not exist yet — create it. Note: Linux is not an officially supported platform for Claude Desktop; community builds use ~/.config/Claude/claude_desktop_config.json by convention.",
  },
  {
    q: "Does Claude Desktop support remote (HTTP) MCP servers?",
    a: "Yes, but not through the config file. Anthropic explicitly states Claude Desktop will not connect to remote servers configured directly via claude_desktop_config.json. Add them through Settings → Connectors → Add custom connector instead. The legacy SSE transport is being phased out in favor of streamable HTTP.",
  },
  {
    q: "Why are my MCP tools missing after I restart Claude Desktop?",
    a: "Claude Desktop only re-reads the config on a full quit, not a window close. On macOS that means Cmd+Q, not the red dot. After editing the config, fully quit and reopen.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Claude Desktop reads MCP servers from a single config file that
        lives in a platform-specific path. The schema is the same across macOS, Windows, and Linux.
        This guide gives you the exact path, the JSON shape, three complete examples, and the
        differences with Cursor and Claude Code so you can move between hosts without surprises.
      </p>

      <h2 id="config-path">The config file path</h2>
      <p>
        Claude Desktop reads a single JSON file at startup. The path differs by operating system:
      </p>
      <ul>
        <li>
          <strong>macOS</strong>:{" "}
          <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
        </li>
        <li>
          <strong>Windows</strong>: <code>%APPDATA%\Claude\claude_desktop_config.json</code>
        </li>
        <li>
          <strong>Linux</strong> (community builds only &mdash; Anthropic does not ship an official
          Linux client): <code>~/.config/Claude/claude_desktop_config.json</code>
        </li>
      </ul>
      <p>
        If the file does not exist, create it. The simplest possible content is an empty object:{" "}
        <code>{`{ "mcpServers": {} }`}</code>. Claude Desktop also has a UI for managing servers
        under Settings &rarr; Developer &rarr; Edit Config, which opens this exact file in your
        default editor.
      </p>

      <h2 id="stdio-example">Example: stdio servers</h2>
      <p>
        The most common case &mdash; running an MCP server as a child process on your machine. This
        config exposes the filesystem and a Postgres database to Claude:
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/me/Projects"
      ]
    },
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ]
    }
  }
}`}</code>
      </pre>
      <p>
        Claude Desktop spawns each server with the given command and arguments. The environment is
        empty by default; if a server needs an API key, declare it in an <code>env</code> block on
        the same level as <code>command</code>.
      </p>

      <h2 id="http-example">Example: remote HTTP servers</h2>
      <p>
        For servers you host elsewhere (managed runtimes, your own VPS), use the remote MCP flow.
        This is what you want when the server holds long-lived state, secrets, or needs to be shared
        across your devices.
      </p>
      <p>
        Important: Claude Desktop does <strong>not</strong> read remote-server URLs from{" "}
        <code>claude_desktop_config.json</code>. Anthropic&apos;s docs are explicit about this.
        Instead, add the server through the UI: open Settings &rarr; Connectors &rarr;{" "}
        <strong>Add custom connector</strong>, paste the streamable-HTTP endpoint URL, and provide
        an authentication token. Claude Desktop then handles the connection lifecycle for you.
      </p>
      <p>
        The legacy SSE transport is being retired; new remote servers should expose the
        streamable-HTTP endpoint convention. Most managed runtimes (including TwinMCP) generate the
        correct URL automatically and show you exactly what to paste.
      </p>

      <h2 id="env-vars">Passing environment variables</h2>
      <p>
        Claude Desktop does <strong>not</strong> inherit your shell environment. If an MCP server
        expects <code>GITHUB_PERSONAL_ACCESS_TOKEN</code>, exporting it in your terminal does
        nothing. The token must appear inside the <code>env</code> block of each server that needs
        it.
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
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
        For shared machines or multi-account setups, prefer hosted MCPs: the token lives
        server-side, and Claude Desktop only sees a bearer scoped to your user.
      </p>

      <h2 id="vs-cursor">How this differs from Cursor and Claude Code</h2>
      <p>
        The three Anthropic-aware hosts use slightly different conventions despite the same
        underlying protocol:
      </p>
      <ul>
        <li>
          <strong>Claude Desktop</strong> reads one config file, requires a full quit to reload, has
          a built-in &ldquo;Edit Config&rdquo; menu item.
        </li>
        <li>
          <strong>Cursor</strong> merges a global config (<code>~/.cursor/mcp.json</code>) with a
          per-project config (<code>.cursor/mcp.json</code>). Reload via the MCP panel without
          restarting.
        </li>
        <li>
          <strong>Claude Code</strong> manages servers through a CLI: <code>claude mcp add</code>,{" "}
          <code>claude mcp list</code>, <code>claude mcp remove</code>. Config lives in an internal
          SQLite database.
        </li>
      </ul>
      <p>
        The server itself is identical across all three. Migrating from one host to another is just
        a config translation.
      </p>

      <h2 id="next">Where to go next</h2>
      <p>
        For Cursor-specific quirks, see the{" "}
        <Link href={"/blog/cursor-mcp-setup" as Route}>Cursor MCP setup guide</Link>. For a curated
        list of MCP servers worth installing day-one, read{" "}
        <Link href={"/blog/production-mcp-servers" as Route}>10 production-ready MCP servers</Link>.
        If you want to use the same servers across Claude Desktop, Cursor, and Claude Code without
        re-configuring three places, <Link href="/">TwinMCP&apos;s hosted MCPs</Link> work in all
        three with a single URL.
      </p>
    </PostLayout>
  );
}
