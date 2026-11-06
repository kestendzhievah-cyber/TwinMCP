import { describe, expect, it } from "vitest";
import {
  coreName,
  matchCatalogue,
  migrationCatalogue,
  packageOfStartCmd,
  parseMigrationInput,
  planMigration,
  stripVersion,
  yamlConfigKeys,
} from "@/lib/migrate/smithery";
import { OFFICIAL_MCPS } from "@/lib/servers/seed-catalog";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";

const CATALOGUE = migrationCatalogue(OFFICIAL_MCPS, PROMO_EXCLUDED_MCP_SLUGS);

describe("packageOfStartCmd / stripVersion", () => {
  it("reads the package of npx and uvx commands", () => {
    expect(packageOfStartCmd("npx -y @notionhq/notion-mcp-server@2.5.1")).toEqual({
      tool: "npx",
      pkg: "@notionhq/notion-mcp-server",
    });
    expect(packageOfStartCmd("npx -y airtable-mcp-server@1.14.0")).toEqual({
      tool: "npx",
      pkg: "airtable-mcp-server",
    });
    expect(packageOfStartCmd("uvx mcp-server-fetch")).toEqual({
      tool: "uvx",
      pkg: "mcp-server-fetch",
    });
    expect(packageOfStartCmd("uvx --from git+https://x/y.git z")).toBeNull();
    expect(packageOfStartCmd("twinmcp-docs-proxy")).toBeNull();
  });
  it("strips versions, scoped or not", () => {
    expect(stripVersion("@a/b@1.2.3")).toBe("@a/b");
    expect(stripVersion("b@latest")).toBe("b");
    expect(stripVersion("pkg==1.0")).toBe("pkg");
  });
});

describe("migrationCatalogue", () => {
  it("lists only box MCPs, with their package and the top-up flag", () => {
    const notion = CATALOGUE.find((c) => c.slug === "notion");
    expect(notion?.pkg).toBe("@notionhq/notion-mcp-server");
    expect(notion?.config.map((f) => f.key)).toContain("OPENAPI_MCP_HEADERS");
    expect(CATALOGUE.some((c) => c.slug === "twinmcp-docs")).toBe(false);
    for (const slug of PROMO_EXCLUDED_MCP_SLUGS) {
      expect(CATALOGUE.find((c) => c.slug === slug)?.needsTopUp).toBe(true);
    }
  });
});

describe("parseMigrationInput", () => {
  it("reads a server.smithery.ai URL", () => {
    const p = parseMigrationInput(
      "https://server.smithery.ai/@upstash/context7-mcp/mcp?api_key=xyz"
    );
    expect(p.sources).toContainEqual({ kind: "smithery", qualifiedName: "@upstash/context7-mcp" });
    expect(p.smitheryUrl).toMatch(/^https:\/\/server\.smithery\.ai\//);
  });
  it("reads a registry page and the Smithery CLI", () => {
    expect(
      parseMigrationInput("https://smithery.ai/server/@smithery-ai/brave-search").sources
    ).toContainEqual({ kind: "smithery", qualifiedName: "@smithery-ai/brave-search" });
    expect(
      parseMigrationInput("npx -y @smithery/cli@latest install @acme/weather --client cursor")
        .sources
    ).toContainEqual({ kind: "smithery", qualifiedName: "@acme/weather" });
  });
  it("reads npx, uvx, npm, PyPI and GitHub inputs", () => {
    expect(parseMigrationInput("npx -y firecrawl-mcp@3.0.0").sources).toContainEqual({
      kind: "npm",
      pkg: "firecrawl-mcp",
    });
    expect(parseMigrationInput("uvx mcp-server-time").sources).toContainEqual({
      kind: "pypi",
      pkg: "mcp-server-time",
    });
    expect(
      parseMigrationInput("https://www.npmjs.com/package/@hubspot/mcp-server").sources
    ).toContainEqual({ kind: "npm", pkg: "@hubspot/mcp-server" });
    expect(parseMigrationInput("https://pypi.org/project/wikipedia-mcp/").sources).toContainEqual({
      kind: "pypi",
      pkg: "wikipedia-mcp",
    });
    expect(
      parseMigrationInput(
        "https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps"
      ).sources
    ).toContainEqual({
      kind: "github",
      owner: "modelcontextprotocol",
      repo: "servers",
      path: "src/google-maps",
    });
    expect(
      parseMigrationInput("https://github.com/makenotion/notion-mcp-server").sources
    ).toContainEqual({ kind: "github", owner: "makenotion", repo: "notion-mcp-server" });
  });
  it("reads a smithery.yaml: config keys, published package, container runtime", () => {
    const yaml = `startCommand:
  type: stdio
  configSchema:
    type: object
    required:
      - apiKey
    properties:
      apiKey:
        type: string
        description: Your API key
      region:
        type: string
  commandFunction: |-
    (config) => ({ command: 'npx', args: ['-y', 'acme-weather-mcp@1.0.0'], env: { API_KEY: config.apiKey } })
`;
    const p = parseMigrationInput(yaml);
    expect(p.yaml).toBe(true);
    expect(p.configKeys).toEqual(["apiKey", "region"]);
    expect(p.sources).toContainEqual({ kind: "npm", pkg: "acme-weather-mcp" });
    expect(
      parseMigrationInput("runtime: container\nstartCommand:\n  type: http\n").sources
    ).toContainEqual({ kind: "docker" });
    expect(yamlConfigKeys("properties:\n  a: 1\n  b:\n    type: string\nother: x")).toEqual([
      "a",
      "b",
    ]);
  });
  it("treats a bare name as a Smithery name and never throws on junk", () => {
    expect(parseMigrationInput("@acme/weather").sources).toEqual([
      { kind: "smithery", qualifiedName: "@acme/weather" },
    ]);
    expect(parseMigrationInput("   ").sources).toEqual([]);
    expect(() => parseMigrationInput("%%% ??? <script>")).not.toThrow();
  });
});

describe("matchCatalogue", () => {
  it("matches exactly on the package or the repository", () => {
    expect(
      matchCatalogue([{ kind: "npm", pkg: "@notionhq/notion-mcp-server" }], CATALOGUE)
    ).toMatchObject({ entry: { slug: "notion" }, confidence: "exact" });
    expect(
      matchCatalogue([{ kind: "smithery", qualifiedName: "@upstash/context7-mcp" }], CATALOGUE)
    ).toMatchObject({ entry: { slug: "context7" }, confidence: "exact" });
    expect(
      matchCatalogue(
        [{ kind: "github", owner: "makenotion", repo: "notion-mcp-server" }],
        CATALOGUE
      )
    ).toMatchObject({ entry: { slug: "notion" }, confidence: "exact" });
  });
  it("needs the subfolder to match a monorepo entry", () => {
    expect(
      matchCatalogue(
        [{ kind: "github", owner: "modelcontextprotocol", repo: "servers" }],
        CATALOGUE
      )
    ).toBeNull();
    expect(
      matchCatalogue(
        [
          {
            kind: "github",
            owner: "modelcontextprotocol",
            repo: "servers",
            path: "src/google-maps",
          },
        ],
        CATALOGUE
      )?.entry.slug
    ).toBe("google-maps");
  });
  it("falls back to a probable match on the name", () => {
    expect(coreName("@smithery-ai/brave-search")).toBe("brave-search");
    expect(
      matchCatalogue([{ kind: "smithery", qualifiedName: "@smithery-ai/brave-search" }], CATALOGUE)
    ).toMatchObject({ entry: { slug: "brave-search" }, confidence: "probable" });
  });
});

describe("planMigration", () => {
  it("routes a catalogue MCP to the catalogue", () => {
    const plan = planMigration("https://server.smithery.ai/@upstash/context7-mcp/mcp", CATALOGUE);
    expect(plan).toMatchObject({ route: "catalogue", entry: { slug: "context7" } });
  });
  it("routes an unknown npm or PyPI package to publishing", () => {
    expect(planMigration("npx -y acme-weather-mcp", CATALOGUE)).toMatchObject({
      route: "publish",
      runtime: "node",
      pkg: "acme-weather-mcp",
      startCmd: "npx -y acme-weather-mcp",
      slug: "acme-weather",
    });
    expect(planMigration("uvx acme-tools", CATALOGUE)).toMatchObject({
      route: "publish",
      runtime: "python",
      startCmd: "uvx acme-tools",
    });
  });
  it("routes Docker-only and package-less servers to a manual migration", () => {
    expect(
      planMigration("runtime: container\nstartCommand:\n  type: http\n", CATALOGUE)
    ).toMatchObject({ route: "manual", reason: "docker" });
    expect(planMigration("@acme/private-thing", CATALOGUE)).toMatchObject({
      route: "manual",
      reason: "no-package",
      qualifiedName: "@acme/private-thing",
    });
    expect(planMigration("hello there", CATALOGUE)).toMatchObject({
      route: "manual",
      reason: "unknown",
    });
    expect(planMigration("", CATALOGUE)).toEqual({ route: "empty" });
  });
});
