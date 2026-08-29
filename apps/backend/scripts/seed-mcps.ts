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
    startCmd: "npx -y @upstash/context7-mcp@4.0.4",
    version: "4.0.4",
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
    startCmd: "npx -y @modelcontextprotocol/server-brave-search@0.6.2",
    version: "0.6.2",
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
    startCmd: "npx -y @modelcontextprotocol/server-google-maps@0.6.2",
    version: "0.6.2",
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
    startCmd: "npx -y @modelcontextprotocol/server-slack@2025.4.25",
    version: "2025.4.25",
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
    startCmd: "npx -y @modelcontextprotocol/server-gitlab@2025.4.25",
    version: "2025.4.25",
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
    // Node server (npm: @notionhq/notion-mcp-server, official Notion). Search,
    // read, create and update pages/databases. Auth via OPENAPI_MCP_HEADERS (a
    // JSON blob with the integration token + Notion-Version).
    slug: "notion",
    name: "Notion",
    description:
      "Search, read, create and update Notion pages and databases from the model. Requires a Notion integration token (share the pages with your integration first).",
    repoUrl: "https://github.com/makenotion/notion-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @notionhq/notion-mcp-server@2.5.1",
    version: "2.5.1",
    configSchema: {
      properties: {
        OPENAPI_MCP_HEADERS: {
          type: "string",
          required: true,
          secret: true,
          description:
            'JSON headers, e.g. {"Authorization":"Bearer ntn_your_token","Notion-Version":"2022-06-28"}',
        },
      },
    },
  },
  {
    // Node server (npm: airtable-mcp-server). List/read/create/update records and
    // inspect base schema. Needs an Airtable personal access token.
    slug: "airtable",
    name: "Airtable",
    description:
      "Read and write Airtable — list bases and tables, query, create and update records, and inspect schema. Requires an Airtable personal access token.",
    repoUrl: "https://github.com/domdomegg/airtable-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y airtable-mcp-server@1.14.0",
    version: "1.14.0",
    configSchema: {
      properties: {
        AIRTABLE_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Airtable personal access token (pat…) with the needed scopes.",
        },
      },
    },
  },
  {
    // Node server (npm: @abhiz123/todoist-mcp-server). Create/list/update/complete
    // Todoist tasks with natural language. Needs a Todoist API token.
    slug: "todoist",
    name: "Todoist",
    description:
      "Manage Todoist tasks from the model — create, list, update and complete tasks and projects with natural language. Requires a Todoist API token.",
    repoUrl: "https://github.com/abhiz123/todoist-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @abhiz123/todoist-mcp-server@0.1.0",
    version: "0.1.0",
    configSchema: {
      properties: {
        TODOIST_API_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Todoist API token (Todoist → Settings → Integrations → Developer).",
        },
      },
    },
  },
  {
    // Node server (npm: exa-mcp-server, by Exa Labs). AI-optimized web search +
    // content retrieval. Needs an Exa API key.
    slug: "exa",
    name: "Exa Search",
    description:
      "AI-optimized web search and content retrieval via Exa — semantic search, find similar pages, and pull clean page contents for the model. Requires an Exa API key.",
    repoUrl: "https://github.com/exa-labs/exa-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y exa-mcp-server@3.4.1",
    version: "3.4.1",
    configSchema: {
      properties: {
        EXA_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Exa API key (dashboard.exa.ai).",
        },
      },
    },
  },
  {
    // Node server (npm: tavily-mcp, by Tavily). Web search + extract optimized
    // for LLMs. Needs a Tavily API key.
    slug: "tavily",
    name: "Tavily Search",
    description:
      "LLM-optimized web search and content extraction via Tavily — search, get direct answers, and pull clean page content. Requires a Tavily API key.",
    repoUrl: "https://github.com/tavily-ai/tavily-mcp",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y tavily-mcp@0.2.22",
    version: "0.2.22",
    configSchema: {
      properties: {
        TAVILY_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Tavily API key (app.tavily.com).",
        },
      },
    },
  },
  {
    // Node server (npm: firecrawl-mcp, by Firecrawl). Scrape, crawl, map and
    // extract structured data from websites. Needs a Firecrawl API key.
    slug: "firecrawl",
    name: "Firecrawl",
    description:
      "Scrape, crawl and map websites into clean markdown or structured data via Firecrawl — turn any site into model-ready content. Requires a Firecrawl API key.",
    repoUrl: "https://github.com/mendableai/firecrawl-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y firecrawl-mcp@3.24.0",
    version: "3.24.0",
    configSchema: {
      properties: {
        FIRECRAWL_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Firecrawl API key (firecrawl.dev).",
        },
      },
    },
  },
  {
    // Node server (npm: @tacticlaunch/mcp-linear). Issues, projects, comments and
    // cycles in Linear. Needs a Linear API token.
    slug: "linear",
    name: "Linear",
    description:
      "Work with Linear from the model — search, create and update issues, projects, comments and cycles. Requires a Linear API token.",
    repoUrl: "https://github.com/tacticlaunch/mcp-linear",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @tacticlaunch/mcp-linear@1.4.3",
    version: "1.4.3",
    configSchema: {
      properties: {
        LINEAR_API_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Linear API token (Linear → Settings → API → Personal API keys).",
        },
      },
    },
  },
  {
    // Node server (npm: @stripe/mcp, official Stripe). Customers, payments,
    // invoices, products, etc. Pass a RESTRICTED key for safety.
    slug: "stripe",
    name: "Stripe",
    description:
      "Manage Stripe from the model — customers, payments, invoices, products, prices and refunds. Use a restricted API key. Requires a Stripe secret/restricted key.",
    repoUrl: "https://github.com/stripe/agent-toolkit",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @stripe/mcp@0.3.3 --tools=all --api-key=$STRIPE_SECRET_KEY",
    version: "0.3.3",
    configSchema: {
      properties: {
        STRIPE_SECRET_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Stripe secret or restricted key (rk_… recommended for least privilege).",
        },
      },
    },
  },
  {
    // Python server (PyPI: postgres-mcp, by Crystal DBA), run via uvx. Query +
    // inspect a Postgres DB; restricted access-mode is read-only-ish. Needs a
    // connection string. (Distinct from the retired official server.)
    slug: "postgres",
    name: "PostgreSQL",
    description:
      "Query and inspect a PostgreSQL database — run SQL, explore schema, and analyze indexes/health. Runs in restricted mode by default. Requires a connection string.",
    repoUrl: "https://github.com/crystaldba/postgres-mcp",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx postgres-mcp --access-mode=restricted",
    version: "latest",
    configSchema: {
      properties: {
        DATABASE_URI: {
          type: "string",
          required: true,
          secret: true,
          description: "Postgres connection string, e.g. postgresql://user:pass@host:5432/dbname",
        },
      },
    },
  },
  {
    // Node server (npm: mongodb-mcp-server, official MongoDB). Query collections,
    // run aggregations, inspect schema. Needs a connection string.
    slug: "mongodb",
    name: "MongoDB",
    description:
      "Query and manage MongoDB — find and aggregate documents, inspect collections and schema, and run admin operations. Requires a connection string.",
    repoUrl: "https://github.com/mongodb-js/mongodb-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y mongodb-mcp-server@2.1.0",
    version: "2.1.0",
    configSchema: {
      properties: {
        MDB_MCP_CONNECTION_STRING: {
          type: "string",
          required: true,
          secret: true,
          description: "MongoDB connection string, e.g. mongodb+srv://user:pass@cluster/db",
        },
      },
    },
  },
  {
    // Node server (npm: @negokaz/excel-mcp-server). Read/write .xlsx files inside
    // the box — no API key. Point it at spreadsheet paths in your box.
    slug: "excel",
    name: "Excel",
    description:
      "Read and write Excel (.xlsx) spreadsheets inside your box — read ranges, write cells and formulas, create sheets. No API key; works on files in your box.",
    repoUrl: "https://github.com/negokaz/excel-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @negokaz/excel-mcp-server@0.12.0",
    version: "0.12.0",
    configSchema: { properties: {} },
  },
  {
    // Node server (npm: server-perplexity-ask, by Perplexity). Ask Perplexity a
    // question and get a cited, web-grounded answer. Needs a Perplexity API key.
    slug: "perplexity",
    name: "Perplexity",
    description:
      "Ask Perplexity from the model — get web-grounded, cited answers to real-time questions. Requires a Perplexity API key.",
    repoUrl: "https://github.com/ppl-ai/modelcontextprotocol",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y server-perplexity-ask@0.1.3",
    version: "0.1.3",
    configSchema: {
      properties: {
        PERPLEXITY_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Perplexity API key (perplexity.ai → Settings → API).",
        },
      },
    },
  },
  {
    // Node server (npm: figma-developer-mcp, Framelink). Reads Figma file data +
    // layout for the model. Runs in stdio mode with --stdio. Needs a Figma token.
    slug: "figma",
    name: "Figma",
    description:
      "Give the model your Figma designs — read file layout, components, styles and content to generate accurate UI code. Requires a Figma API token.",
    repoUrl: "https://github.com/GLips/Figma-Context-MCP",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y figma-developer-mcp@0.13.2 --stdio",
    version: "0.13.2",
    configSchema: {
      properties: {
        FIGMA_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description:
            "Figma personal access token (Figma → Settings → Account → Personal access tokens).",
        },
      },
    },
  },
  {
    // Node server (npm: @apify/actors-mcp-server). Run Apify Actors to scrape the
    // web, crawl sites and extract data. Needs an Apify API token.
    slug: "apify",
    name: "Apify",
    description:
      "Run Apify Actors from the model — scrape websites, crawl pages, and extract structured data at scale. Requires an Apify API token.",
    repoUrl: "https://github.com/apify/actors-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @apify/actors-mcp-server@0.15.3",
    version: "0.15.3",
    configSchema: {
      properties: {
        APIFY_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Apify API token (console.apify.com → Settings → Integrations).",
        },
      },
    },
  },
  {
    // Node server (npm: @elastic/mcp-server-elasticsearch, official Elastic).
    // Search + inspect Elasticsearch indices. Needs a cluster URL + API key.
    slug: "elasticsearch",
    name: "Elasticsearch",
    description:
      "Query and inspect Elasticsearch from the model — search indices, run aggregations, and read mappings. Requires a cluster URL and API key.",
    repoUrl: "https://github.com/elastic/mcp-server-elasticsearch",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @elastic/mcp-server-elasticsearch@0.3.1",
    version: "0.3.1",
    configSchema: {
      properties: {
        ES_URL: {
          type: "string",
          required: true,
          description: "Elasticsearch endpoint, e.g. https://my-cluster.es.io:9243",
        },
        ES_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Elasticsearch API key (base64) with read access.",
        },
      },
    },
  },
  {
    // Node server (npm: @modelcontextprotocol/server-redis). Read/write a Redis
    // instance. The connection URL is passed as an argument.
    slug: "redis",
    name: "Redis",
    description:
      "Read and write a Redis instance from the model — get/set keys, manage lists, hashes and sets, and inspect the store. Requires a Redis connection URL.",
    repoUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/redis",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @modelcontextprotocol/server-redis@2025.4.25 $REDIS_URL",
    version: "2025.4.25",
    configSchema: {
      properties: {
        REDIS_URL: {
          type: "string",
          required: true,
          secret: true,
          description: "Redis connection URL, e.g. redis://user:pass@host:6379",
        },
      },
    },
  },
  {
    // Node server (npm: @openbnb/mcp-server-airbnb). Search Airbnb listings +
    // details. No API key. --ignore-robots-txt lets it fetch listing pages.
    slug: "airbnb",
    name: "Airbnb",
    description:
      "Search Airbnb listings and fetch details from the model — filter by location, dates and guests, and read a listing's specifics. No API key required.",
    repoUrl: "https://github.com/openbnb-org/mcp-server-airbnb",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @openbnb/mcp-server-airbnb@0.3.0 --ignore-robots-txt",
    version: "0.3.0",
    configSchema: { properties: {} },
  },
  {
    // Node server (npm: @e2b/mcp-server, by E2B). Runs the model's code in a
    // secure remote sandbox. Needs an E2B API key.
    slug: "e2b",
    name: "E2B Code Interpreter",
    description:
      "Let the model run code in a secure remote sandbox via E2B — execute Python/JS, install packages, and read the output. Requires an E2B API key.",
    repoUrl: "https://github.com/e2b-dev/mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @e2b/mcp-server@0.2.3",
    version: "0.2.3",
    configSchema: {
      properties: {
        E2B_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your E2B API key (e2b.dev → Dashboard → API Keys).",
        },
      },
    },
  },
  {
    // Python server (PyPI: mcp-hn), run via uvx like fetch. Search + read Hacker
    // News stories and comments. No API key.
    slug: "hackernews",
    name: "Hacker News",
    description:
      "Search and read Hacker News from the model — top/new stories, a story's comments, and user profiles. No API key required.",
    repoUrl: "https://github.com/erithwik/mcp-hn",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-hn",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Node server (npm: @supabase/mcp-server-supabase, official). Manage a
    // Supabase project — tables, SQL, edge functions, logs. --read-only by
    // default here for safety. Needs a Supabase access token.
    slug: "supabase",
    name: "Supabase",
    description:
      "Work with your Supabase project from the model — browse tables, run SQL, read logs and manage schema (read-only by default). Requires a Supabase access token.",
    repoUrl: "https://github.com/supabase-community/supabase-mcp",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @supabase/mcp-server-supabase@0.11.0 --read-only",
    version: "0.11.0",
    configSchema: {
      properties: {
        SUPABASE_ACCESS_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Supabase personal access token (supabase.com → Account → Access Tokens).",
        },
      },
    },
  },
  {
    // Node server (npm: @neondatabase/mcp-server-neon, official). Manage Neon
    // serverless Postgres — projects, branches, SQL. Needs a Neon API key.
    slug: "neon",
    name: "Neon",
    description:
      "Manage Neon serverless Postgres from the model — create projects and branches, run SQL, and inspect databases. Requires a Neon API key.",
    repoUrl: "https://github.com/neondatabase-labs/mcp-server-neon",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @neondatabase/mcp-server-neon@0.6.5 start $NEON_API_KEY",
    version: "0.6.5",
    configSchema: {
      properties: {
        NEON_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Neon API key (console.neon.tech → Account settings → API keys).",
        },
      },
    },
  },
  {
    // Node server (npm: @bytebase/dbhub). Universal database gateway — connect to
    // Postgres/MySQL/SQL Server/SQLite/MariaDB via a DSN. Runs in stdio transport.
    slug: "dbhub",
    name: "DBHub",
    description:
      "Universal database connector — query and inspect Postgres, MySQL, SQL Server, MariaDB or SQLite through one server via a connection string (DSN).",
    repoUrl: "https://github.com/bytebase/dbhub",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @bytebase/dbhub@1.2.1 --transport stdio --dsn $DSN",
    version: "1.2.1",
    configSchema: {
      properties: {
        DSN: {
          type: "string",
          required: true,
          secret: true,
          description: "Database connection string, e.g. postgres://user:pass@host:5432/db",
        },
      },
    },
  },
  {
    // Node server (npm: @browserbasehq/mcp, by Browserbase). Cloud browser
    // automation — navigate, click, extract, screenshot (no local Chromium).
    // Needs a Browserbase API key + project ID.
    slug: "browserbase",
    name: "Browserbase",
    description:
      "Drive a cloud browser from the model — navigate pages, click, fill forms, extract content and screenshot, all in Browserbase's managed browsers. Requires a Browserbase API key + project ID.",
    repoUrl: "https://github.com/browserbase/mcp-server-browserbase",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @browserbasehq/mcp@3.0.0",
    version: "3.0.0",
    configSchema: {
      properties: {
        BROWSERBASE_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Browserbase API key (browserbase.com → Settings).",
        },
        BROWSERBASE_PROJECT_ID: {
          type: "string",
          required: true,
          description: "Your Browserbase project ID.",
        },
      },
    },
  },
  {
    // Node server (npm: youtube-data-mcp-server). Search videos, read metadata,
    // stats and captions via the YouTube Data API. Needs a YouTube API key.
    slug: "youtube-data",
    name: "YouTube Data",
    description:
      "Search YouTube and read video/channel metadata, statistics and captions via the YouTube Data API. Requires a YouTube Data API key.",
    repoUrl: "https://github.com/icraft2170/youtube-data-mcp-server",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y youtube-data-mcp-server@1.0.16",
    version: "1.0.16",
    configSchema: {
      properties: {
        YOUTUBE_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "YouTube Data API v3 key (Google Cloud console).",
        },
      },
    },
  },
  {
    // Python server (PyPI: mcp-server-qdrant, official Qdrant), run via uvx.
    // Store + semantically search memories in a Qdrant vector DB.
    slug: "qdrant",
    name: "Qdrant",
    description:
      "Store and semantically search text in a Qdrant vector database — give the model a long-term, searchable memory. Requires a Qdrant URL and collection name.",
    repoUrl: "https://github.com/qdrant/mcp-server-qdrant",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-server-qdrant",
    version: "latest",
    configSchema: {
      properties: {
        QDRANT_URL: {
          type: "string",
          required: true,
          description: "Qdrant endpoint, e.g. https://xyz.cloud.qdrant.io:6333",
        },
        QDRANT_API_KEY: {
          type: "string",
          secret: true,
          description: "Optional. Qdrant API key (for Qdrant Cloud).",
        },
        COLLECTION_NAME: {
          type: "string",
          required: true,
          description: "Collection to read/write, e.g. twinmcp-memory.",
        },
      },
    },
  },
  {
    // Python server (PyPI: chroma-mcp, official Chroma), run via uvx. Vector
    // search over an in-box ephemeral Chroma DB — no API key.
    slug: "chroma",
    name: "Chroma",
    description:
      "Embed and semantically search documents in a Chroma vector database inside your box — add documents and query by meaning. Runs ephemerally; no API key.",
    repoUrl: "https://github.com/chroma-core/chroma-mcp",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx chroma-mcp --client-type ephemeral",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: mcp-yahoo-finance), run via uvx. Stock quotes,
    // history, and company info via Yahoo Finance. No API key.
    slug: "yahoo-finance",
    name: "Yahoo Finance",
    description:
      "Look up stock prices, historical data, and company information via Yahoo Finance — market data the model can reason over. No API key required.",
    repoUrl: "https://github.com/maxscheijen/mcp-yahoo-finance",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-yahoo-finance",
    version: "latest",
    configSchema: { properties: {} },
  },
  {
    // Python server (PyPI: elevenlabs-mcp, official ElevenLabs), run via uvx.
    // Text-to-speech, voice cloning, speech-to-text. Needs an ElevenLabs API key.
    slug: "elevenlabs",
    name: "ElevenLabs",
    description:
      "Generate speech, clone voices and transcribe audio via ElevenLabs — give the model a voice and audio tools. Requires an ElevenLabs API key.",
    repoUrl: "https://github.com/elevenlabs/elevenlabs-mcp",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx elevenlabs-mcp",
    version: "latest",
    configSchema: {
      properties: {
        ELEVENLABS_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Your ElevenLabs API key (elevenlabs.io → Profile → API key).",
        },
      },
    },
  },
  {
    // Node server (npm: mcp-replicate). Run any Replicate model — image, video,
    // audio, and other ML models. Needs a Replicate API token.
    slug: "replicate",
    name: "Replicate",
    description:
      "Run image, video, audio and other ML models on Replicate from the model — generate media and poll predictions to completion. Requires a Replicate API token.",
    repoUrl: "https://github.com/deepfates/mcp-replicate",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y mcp-replicate@0.1.1",
    version: "0.1.1",
    configSchema: {
      properties: {
        REPLICATE_API_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Your Replicate API token (replicate.com → Account → API tokens).",
        },
      },
    },
  },
  {
    // Python server (PyPI: mcp-clickhouse, official ClickHouse), run via uvx.
    // Run read-only analytical SQL against a ClickHouse cluster. Needs host + creds.
    slug: "clickhouse",
    name: "ClickHouse",
    description:
      "Run fast analytical SQL against a ClickHouse cluster from the model — explore databases and tables and query billions of rows. Requires host and credentials.",
    repoUrl: "https://github.com/ClickHouse/mcp-clickhouse",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-clickhouse",
    version: "latest",
    configSchema: {
      properties: {
        CLICKHOUSE_HOST: {
          type: "string",
          required: true,
          description: "ClickHouse host, e.g. my-cluster.clickhouse.cloud",
        },
        CLICKHOUSE_USER: {
          type: "string",
          required: true,
          description: "ClickHouse username, e.g. default",
        },
        CLICKHOUSE_PASSWORD: {
          type: "string",
          required: true,
          secret: true,
          description: "ClickHouse password.",
        },
      },
    },
  },
  {
    // Node server (npm: @delorenj/mcp-server-trello). Manage Trello boards, lists
    // and cards. Needs a Trello API key + token.
    slug: "trello",
    name: "Trello",
    description:
      "Manage Trello from the model — read boards and lists, create and move cards, add comments and checklists. Requires a Trello API key and token.",
    repoUrl: "https://github.com/delorenj/mcp-server-trello",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @delorenj/mcp-server-trello@1.8.1",
    version: "1.8.1",
    configSchema: {
      properties: {
        TRELLO_API_KEY: {
          type: "string",
          required: true,
          secret: true,
          description: "Trello API key (trello.com/power-ups/admin → your key).",
        },
        TRELLO_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "Trello token (generated from your API key).",
        },
      },
    },
  },
  {
    // Node server (npm: @shopify/dev-mcp, official Shopify). Search Shopify dev
    // docs and introspect the Admin GraphQL schema. No API key.
    slug: "shopify-dev",
    name: "Shopify Dev",
    description:
      "Search Shopify developer documentation and introspect the Admin GraphQL schema from the model — build Shopify apps faster. No API key required.",
    repoUrl: "https://github.com/Shopify/dev-mcp",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y @shopify/dev-mcp@1.14.7",
    version: "1.14.7",
    configSchema: { properties: {} },
  },
  {
    // Node server (npm: mcp-server-kubernetes). Manage a Kubernetes cluster —
    // list/describe/apply resources, logs, exec. Uses the box's kubeconfig.
    slug: "kubernetes",
    name: "Kubernetes",
    description:
      "Operate a Kubernetes cluster from the model — list and describe resources, read logs, and apply manifests. Uses a kubeconfig available in your box.",
    repoUrl: "https://github.com/Flux159/mcp-server-kubernetes",
    runtime: "node",
    installCmd: "true",
    startCmd: "npx -y mcp-server-kubernetes@4.1.4",
    version: "4.1.4",
    configSchema: {
      properties: {
        KUBECONFIG: {
          type: "string",
          description: "Optional. Path to a kubeconfig file inside your box.",
        },
      },
    },
  },
  {
    // Python server (PyPI: mcp-reddit), run via uvx. Read Reddit — hot posts,
    // post details and comment trees. No API key.
    slug: "reddit",
    name: "Reddit",
    description:
      "Browse Reddit from the model — fetch hot posts from a subreddit, read a post's details and its comment tree. No API key required.",
    repoUrl: "https://github.com/adhikasp/mcp-reddit",
    runtime: "node",
    installCmd: "command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh",
    startCmd: "uvx mcp-reddit",
    version: "latest",
    configSchema: { properties: {} },
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
  notion: "productivity",
  todoist: "productivity",
  airtable: "data",
  exa: "web",
  tavily: "web",
  firecrawl: "web",
  linear: "dev",
  stripe: "dev",
  postgres: "data",
  mongodb: "data",
  excel: "data",
  perplexity: "web",
  apify: "web",
  airbnb: "web",
  hackernews: "web",
  figma: "creative",
  elasticsearch: "data",
  redis: "data",
  e2b: "dev",
  supabase: "dev",
  neon: "data",
  dbhub: "data",
  browserbase: "web",
  "youtube-data": "web",
  qdrant: "data",
  chroma: "data",
  "yahoo-finance": "data",
  elevenlabs: "creative",
  replicate: "ai",
  clickhouse: "data",
  trello: "productivity",
  "shopify-dev": "dev",
  kubernetes: "dev",
  reddit: "web",
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
