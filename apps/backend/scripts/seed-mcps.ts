import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = postgres(url, { max: 1, ssl: "require" });
const db = drizzle(client, { schema });

type SeedEntry = {
  slug: string;
  name: string;
  description: string;
  repoUrl?: string;
  runtime: (typeof schema.mcpRuntimes)[number];
  installCmd: string;
  startCmd: string;
  version: string;
  configSchema: {
    properties: Record<
      string,
      {
        type: "string" | "number" | "boolean";
        required?: boolean;
        description?: string;
        secret?: boolean;
      }
    >;
  };
};

// First-party, actively-maintained servers. Node servers run via `npx`; the
// official Python `fetch` server runs via `uvx` — the box ships python3 and we
// bootstrap uv with the curl installer (proven end-to-end against a real box).
// npm versions are PINNED so a regressed/compromised publish can't auto-roll-in.
// github (Go/Docker-only, no docker in the box) stays unpublished below.
const OFFICIAL_MCPS: SeedEntry[] = [
  {
    slug: "twinmcp-docs",
    name: "TwinMCP Docs",
    description:
      "Official TwinMCP documentation retrieval. Auto-installed for every server. Wraps /api/v2/context.",
    repoUrl: "https://github.com/upstash/twinmcp",
    runtime: "node",
    installCmd: "true",
    startCmd: "twinmcp-docs-proxy",
    version: "1.0.0",
    configSchema: { properties: {} },
  },
  {
    slug: "filesystem",
    name: "Filesystem",
    description: "Read/write access to a sandboxed directory inside the box.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-filesystem@2026.1.14 $FILESYSTEM_PATH",
    version: "2026.1.14",
    configSchema: {
      properties: {
        FILESYSTEM_PATH: {
          type: "string",
          required: true,
          description: "Absolute path to expose, e.g. /workspace/home (box user's writable home)",
        },
      },
    },
  },
  {
    slug: "memory",
    name: "Memory",
    description: "Persistent knowledge-graph memory the model can read and write across turns.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-memory@2026.1.26",
    version: "2026.1.26",
    configSchema: { properties: {} },
  },
  {
    slug: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Structured step-by-step reasoning tool for breaking down complex problems.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-sequential-thinking@2025.12.18",
    version: "2025.12.18",
    configSchema: { properties: {} },
  },
  {
    slug: "everything",
    name: "Everything",
    description:
      "Reference MCP server exercising the full protocol — echo, add, long-running progress, env, images. Great for testing a connection end-to-end.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-everything@2026.7.4",
    version: "2026.7.4",
    configSchema: { properties: {} },
  },
  {
    // Official fetch server is Python-only; the box has python3 + we bootstrap uv
    // (curl installer) so it runs via `uvx`. Proven end-to-end against a real box.
    slug: "fetch",
    name: "Fetch",
    description: "Fetch a URL and return its content as markdown (official MCP fetch server).",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-fetch",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: mcp-server-time), run via uvx like fetch. Zero config;
    // returns the current time / converts between IANA timezones.
    slug: "time",
    name: "Time",
    description:
      "Current time and timezone conversion. Ask for the time anywhere or convert between IANA timezones.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-time",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: mcp-server-git), run via uvx. Reads a Git repo inside
    // the box (status/log/diff/show/branch). The user points GIT_REPOSITORY at a
    // repo they've cloned into their box.
    slug: "git",
    name: "Git",
    description:
      "Inspect a Git repository inside your box — status, log, diff, show, branches. Point it at a repo you've cloned in.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-git --repository $GIT_REPOSITORY",
    version: "latest",
    configSchema: {
      properties: {
        GIT_REPOSITORY: {
          type: "string",
          required: true,
          description: "Absolute path to a Git repo inside the box, e.g. /workspace/home/myrepo",
        },
      },
    },
  },
  {
    // Python server (PyPI: mcp-server-sqlite), run via uvx. Zero-config: the DB
    // file is created on first use. SQLITE_DB_PATH overrides the default via a
    // shell default in the launcher (${VAR:-default}); proven end-to-end.
    slug: "sqlite",
    name: "SQLite",
    description:
      "Query and manage a SQLite database inside your box — run SQL, create tables, read and write rows. A database file is created automatically; no setup required.",
    repoUrl: "https://pypi.org/project/mcp-server-sqlite/",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-sqlite --db-path ${SQLITE_DB_PATH:-/workspace/home/twinmcp.db}",
    version: "latest",
    configSchema: {
      properties: {
        SQLITE_DB_PATH: {
          type: "string",
          description:
            "Optional. Absolute path to the SQLite file inside your box. Defaults to /workspace/home/twinmcp.db.",
        },
      },
    },
  },
  {
    // Python server (PyPI: duckduckgo-mcp-server), run via uvx. Web search with
    // NO API key — DuckDuckGo. Proven end-to-end (returned live results).
    slug: "duckduckgo",
    name: "DuckDuckGo Search",
    description:
      "Search the web via DuckDuckGo and fetch page content as clean text. No API key — works out of the box.",
    repoUrl: "https://github.com/nickclyde/duckduckgo-mcp-server",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx duckduckgo-mcp-server",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: wikipedia-mcp), run via uvx. Public Wikipedia API, no
    // key. Proven end-to-end (search returned live results).
    slug: "wikipedia",
    name: "Wikipedia",
    description:
      "Search Wikipedia and pull article summaries, sections, and links for grounded facts. No API key required.",
    repoUrl: "https://pypi.org/project/wikipedia-mcp/",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx wikipedia-mcp",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: mcp-server-calculator), run via uvx. Precise math the
    // model can trust. Zero config. Proven end-to-end (6*7 → 42).
    slug: "calculator",
    name: "Calculator",
    description:
      "Evaluate precise mathematical expressions — arithmetic the model can rely on instead of guessing.",
    repoUrl: "https://pypi.org/project/mcp-server-calculator/",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-calculator",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: markitdown-mcp, Microsoft), run via uvx. Converts a
    // URL / PDF / Office doc / data URI to Markdown. Proven end-to-end.
    slug: "markitdown",
    name: "MarkItDown",
    description:
      "Convert a URL, PDF, Office document, or data URI to clean Markdown (Microsoft MarkItDown). Great for feeding documents to the model.",
    repoUrl: "https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx markitdown-mcp",
    version: "latest",
    configSchema: { properties: {} },
  },
];

// Servers with no viable runtime in a Node box: github (Go/Docker-only) and the
// old postgres server (deprecated + Docker-only successor; no docker in the box).
// Unpublished (not deleted — installs keep their FK).
const RETIRED_SLUGS = ["github", "postgres-readonly"];

async function main() {
  console.log(`[seed] upserting ${OFFICIAL_MCPS.length} official MCPs…`);
  for (const m of OFFICIAL_MCPS) {
    await db
      .insert(schema.mcpServers)
      .values({
        id: randomUUID(),
        slug: m.slug,
        name: m.name,
        description: m.description,
        repoUrl: m.repoUrl ?? null,
        runtime: m.runtime,
        installCmd: m.installCmd,
        startCmd: m.startCmd,
        version: m.version,
        configSchema: m.configSchema,
        isOfficial: true,
        isPublic: true,
      })
      // Upsert so re-seeding actually updates install/start/version on existing rows.
      .onConflictDoUpdate({
        target: schema.mcpServers.slug,
        set: {
          name: m.name,
          description: m.description,
          repoUrl: m.repoUrl ?? null,
          runtime: m.runtime,
          installCmd: m.installCmd,
          startCmd: m.startCmd,
          version: m.version,
          configSchema: m.configSchema,
          isOfficial: true,
          isPublic: true,
        },
      });
    console.log(`  ✓ ${m.slug}@${m.version}`);
  }

  // Hide deprecated/archived official entries from the catalog (keep rows for FK).
  const retired = await db
    .update(schema.mcpServers)
    .set({ isPublic: false })
    .where(
      and(inArray(schema.mcpServers.slug, RETIRED_SLUGS), eq(schema.mcpServers.isOfficial, true))
    )
    .returning({ slug: schema.mcpServers.slug });
  for (const r of retired) console.log(`  ⊘ unpublished deprecated ${r.slug}`);

  console.log("[seed] done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
