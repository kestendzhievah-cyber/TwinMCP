import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
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
  configSchema: { properties: Record<string, { type: "string" | "number" | "boolean"; required?: boolean; description?: string; secret?: boolean }> };
};

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
    configSchema: { properties: {} },
  },
  {
    slug: "filesystem",
    name: "Filesystem",
    description: "Read/write access to a sandboxed directory inside the box.",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    runtime: "node",
    installCmd: "npm install -g @modelcontextprotocol/server-filesystem",
    startCmd: "mcp-server-filesystem $FILESYSTEM_PATH",
    configSchema: {
      properties: {
        FILESYSTEM_PATH: {
          type: "string",
          required: true,
          description: "Absolute path to expose, e.g. /workspace",
        },
      },
    },
  },
  {
    slug: "github",
    name: "GitHub",
    description: "Read repos, issues, and PRs from GitHub.",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    runtime: "node",
    installCmd: "npm install -g @modelcontextprotocol/server-github",
    startCmd: "mcp-server-github",
    configSchema: {
      properties: {
        GITHUB_PERSONAL_ACCESS_TOKEN: {
          type: "string",
          required: true,
          secret: true,
          description: "GitHub PAT with repo scope",
        },
      },
    },
  },
  {
    slug: "fetch",
    name: "Fetch",
    description: "HTTP fetch tool for arbitrary URLs.",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    runtime: "node",
    installCmd: "npm install -g @modelcontextprotocol/server-fetch",
    startCmd: "mcp-server-fetch",
    configSchema: { properties: {} },
  },
  {
    slug: "postgres-readonly",
    name: "Postgres (read-only)",
    description: "Run read-only SQL against a Postgres database.",
    repoUrl: "https://github.com/modelcontextprotocol/servers",
    runtime: "node",
    installCmd: "npm install -g @modelcontextprotocol/server-postgres",
    startCmd: "mcp-server-postgres $POSTGRES_URL",
    configSchema: {
      properties: {
        POSTGRES_URL: {
          type: "string",
          required: true,
          secret: true,
          description: "Connection string (e.g. postgresql://user:pass@host:5432/db)",
        },
      },
    },
  },
];

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
        configSchema: m.configSchema,
        isOfficial: true,
        isPublic: true,
      })
      .onConflictDoNothing({ target: schema.mcpServers.slug });
    console.log(`  ✓ ${m.slug}`);
  }
  console.log("[seed] done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
