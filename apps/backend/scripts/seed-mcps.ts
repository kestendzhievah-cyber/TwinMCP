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
  // "local" = runs on the user's machine via `ctx7 connect` (default "box").
  hostMode?: "box" | "local";
  // Marketplace grouping; falls back to the CATEGORY map below, else null.
  category?: string;
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
  {
    // Node server (npm: mcp-server-commands). Runs shell commands / scripts inside
    // the user's OWN isolated box (their sandbox). npm version PINNED. Proven E2E.
    slug: "shell",
    name: "Shell Commands",
    description:
      "Run shell commands and scripts inside your own isolated box — the model can execute code, inspect files, and use the CLI. Runs only in your sandboxed runtime, nowhere else.",
    repoUrl: "https://github.com/g0t4/mcp-server-commands",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y mcp-server-commands@0.8.2",
    version: "0.8.2",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: mcp-server-duckdb), run via uvx. Analytical SQL over a
    // fast in-box DuckDB; db file auto-created. DUCKDB_DB_PATH overrides via a
    // shell default in the launcher. Proven end-to-end.
    slug: "duckdb",
    name: "DuckDB",
    description:
      "Run analytical SQL over a fast in-box DuckDB database — query CSV/Parquet/JSON files directly, aggregate, and analyze. A database file is created automatically.",
    repoUrl: "https://pypi.org/project/mcp-server-duckdb/",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-duckdb --db-path ${DUCKDB_DB_PATH:-/workspace/home/twin.duckdb}",
    version: "latest",
    configSchema: {
      properties: {
        DUCKDB_DB_PATH: {
          type: "string",
          description:
            "Optional. Absolute path to the DuckDB file inside your box. Defaults to /workspace/home/twin.duckdb.",
        },
      },
    },
  },
  {
    // Python server (PyPI: arxiv-mcp-server), run via uvx. Search + read arXiv
    // papers; downloads land in ARXIV_STORAGE_PATH (shell default). Proven E2E.
    slug: "arxiv",
    name: "arXiv",
    description:
      "Search and read arXiv research papers — full-text search with filters, fetch abstracts, and download papers as Markdown for the model to read. No API key.",
    repoUrl: "https://pypi.org/project/arxiv-mcp-server/",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx arxiv-mcp-server --storage-path ${ARXIV_STORAGE_PATH:-/workspace/home/arxiv}",
    version: "latest",
    configSchema: {
      properties: {
        ARXIV_STORAGE_PATH: {
          type: "string",
          description:
            "Optional. Absolute path where downloaded papers are stored in your box. Defaults to /workspace/home/arxiv.",
        },
      },
    },
  },
  {
    // Node server (npm: @sinco-lab/mcp-youtube-transcript). Fetches YouTube
    // transcripts by URL — no API key. npm version PINNED. Proven end-to-end.
    slug: "youtube",
    name: "YouTube Transcript",
    description:
      "Fetch the transcript/subtitles of any YouTube video by URL — perfect for summarizing or searching video content. No API key required.",
    repoUrl: "https://github.com/sinco-lab/mcp-youtube-transcript",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @sinco-lab/mcp-youtube-transcript@0.0.12",
    version: "0.0.12",
    configSchema: { properties: {} },
  },
  {
    // Node server (npm: @antv/mcp-server-chart, AntV). Generates chart images
    // from data and returns a URL. npm version PINNED. Proven end-to-end.
    slug: "chart",
    name: "Charts",
    description:
      "Generate 25+ chart types (line, bar, pie, area, scatter, maps, and more) from your data and get a rendered image URL — data visualization for the model (AntV).",
    repoUrl: "https://github.com/antvis/mcp-server-chart",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @antv/mcp-server-chart@0.9.10",
    version: "0.9.10",
    configSchema: { properties: {} },
  },

  // ─────────────────────────── Connectors (need an API key/token) ───────────────────────────
  // These run in a box exactly like the servers above (npx / uvx). They use
  // `@latest` because their published versions weren't box-verified here — pin an
  // exact version once you've confirmed a working install (matches the npm entries
  // above). Secrets are entered per-user at install and injected as box env vars.
  {
    // Node server (npm: @upstash/context7-mcp, by Upstash). Injects up-to-date,
    // version-specific library docs + code examples into context. No API key.
    slug: "context7",
    name: "Context7",
    description:
      "Pull up-to-date, version-specific documentation and code examples for any library straight into the model's context. No API key — works out of the box.",
    repoUrl: "https://github.com/upstash/context7",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @upstash/context7-mcp@latest",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Node server (npm: @modelcontextprotocol/server-brave-search). Web + local
    // search via the Brave Search API. Needs a free Brave API key.
    slug: "brave-search",
    name: "Brave Search",
    description:
      "Search the web and local businesses via the Brave Search API — fast, privacy-first results for the model. Requires a free Brave Search API key.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-brave-search@latest",
    version: "latest",
    configSchema: {
      properties: {
        BRAVE_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Brave Search API key (free tier at brave.com/search/api).",
        },
      },
    },
  },
  {
    // Node server (npm: @modelcontextprotocol/server-google-maps). Places,
    // geocoding, directions, distance matrix. Needs a Google Maps API key.
    slug: "google-maps",
    name: "Google Maps",
    description:
      "Geocode addresses, search places, get directions and distances, and look up place details via the Google Maps API. Requires a Google Maps API key.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-google-maps@latest",
    version: "latest",
    configSchema: {
      properties: {
        GOOGLE_MAPS_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Google Maps Platform API key (with Places + Directions enabled).",
        },
      },
    },
  },
  {
    // Node server (npm: @modelcontextprotocol/server-slack). Read/post to Slack.
    // Needs a Slack bot token + workspace/team ID.
    slug: "slack",
    name: "Slack",
    description:
      "Read and post to Slack — list channels, fetch history, send messages and replies, add reactions, and look up users. Requires a Slack bot token.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-slack@latest",
    version: "latest",
    configSchema: {
      properties: {
        SLACK_BOT_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Slack bot token (xoxb-…) with the channels/chat scopes.",
        },
        SLACK_TEAM_ID: {
          type: "string",
          required: true,
          description: "Your Slack workspace/team ID (starts with T…).",
        },
      },
    },
  },
  {
    // Node server (npm: @modelcontextprotocol/server-gitlab). Projects, files,
    // issues, merge requests. Needs a GitLab personal access token.
    slug: "gitlab",
    name: "GitLab",
    description:
      "Work with GitLab from the model — search and read projects, browse files, create issues and merge requests, and push changes. Requires a GitLab access token.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-gitlab@latest",
    version: "latest",
    configSchema: {
      properties: {
        GITLAB_PERSONAL_ACCESS_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "GitLab personal access token with the api scope.",
        },
        GITLAB_API_URL: {
          type: "string",
          description:
            "Optional. Self-hosted GitLab API URL. Defaults to https://gitlab.com/api/v4.",
        },
      },
    },
  },
  {
    // Python server (PyPI: mcp-server-sentry), run via uvx like fetch. Pulls a
    // Sentry issue's stack trace + metadata into context. Needs an auth token.
    slug: "sentry",
    name: "Sentry",
    description:
      "Pull Sentry issue and error details into the model's context — fetch a stack trace and metadata by issue ID or URL to debug faster. Requires a Sentry auth token.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sentry",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-sentry --auth-token $SENTRY_AUTH_TOKEN",
    version: "latest",
    configSchema: {
      properties: {
        SENTRY_AUTH_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Sentry auth token (Settings → Account → API → Auth Tokens).",
        },
      },
    },
  },

  {
    // LOCAL tool: runs on the USER's machine via `ctx7 connect`, not in a box.
    // blender-mcp bridges to the BlenderMCP add-on socket (localhost:9876), which
    // only the user's own machine can reach — hence hostMode "local".
    slug: "blender",
    name: "Blender",
    description:
      "Drive Blender from your LLM — create/edit 3D scenes, objects, and materials, and run Python inside Blender. Runs locally via the TwinMCP agent; requires the BlenderMCP add-on installed and running in Blender.",
    repoUrl: "https://github.com/ahujasid/blender-mcp",
    runtime: "python",
    installCmd: "true",
    startCmd: "uvx blender-mcp",
    version: "latest",
    hostMode: "local",
    configSchema: { properties: {} },
  },
];

// Servers with no viable runtime in a Node box: github (Go/Docker-only) and the
// old postgres server (deprecated + Docker-only successor; no docker in the box).
// Unpublished (not deleted — installs keep their FK).
const RETIRED_SLUGS = ["github", "postgres-readonly"];

// Marketplace category per official slug (keeps the entries above uncluttered).
const CATEGORY: Record<string, string> = {
  "twinmcp-docs": "docs",
  filesystem: "dev",
  git: "dev",
  shell: "dev",
  memory: "utility",
  time: "utility",
  calculator: "utility",
  everything: "utility",
  "sequential-thinking": "ai",
  fetch: "web",
  duckduckgo: "web",
  wikipedia: "web",
  arxiv: "web",
  youtube: "web",
  sqlite: "data",
  duckdb: "data",
  markitdown: "data",
  chart: "data",
  blender: "creative",
  // Connectors
  context7: "docs",
  "brave-search": "web",
  "google-maps": "web",
  gitlab: "dev",
  sentry: "dev",
  slack: "productivity",
};

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
        hostMode: m.hostMode ?? "box",
        category: m.category ?? CATEGORY[m.slug] ?? null,
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
          hostMode: m.hostMode ?? "box",
          category: m.category ?? CATEGORY[m.slug] ?? null,
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
