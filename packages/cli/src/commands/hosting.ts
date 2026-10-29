import type { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { input, password } from "@inquirer/prompts";

import { getBaseUrl } from "../utils/api.js";
import { loadTokens } from "../utils/auth.js";
import { log } from "../utils/logger.js";
import { trackEvent } from "../utils/tracking.js";
import {
  BOX_SIZES,
  HostingClient,
  NO_KEY_MESSAGE,
  buildServerUrl,
  coerceConfig,
  formatTable,
  isValidSlug,
  parseConfigPairs,
  resolveApiKey,
  type BoxSize,
  type ConfigSchema,
  type ConfigValue,
} from "../utils/hosting.js";

/** A management client from --key, TWINMCP_API_KEY or the stored login. */
export function managementClient(flagKey?: string): HostingClient {
  const resolved = resolveApiKey({
    flag: flagKey,
    env: process.env.TWINMCP_API_KEY,
    stored: loadTokens()?.access_token ?? null,
  });
  if (!resolved) throw new Error(NO_KEY_MESSAGE);
  return new HostingClient(getBaseUrl(), resolved.key);
}

function fail(err: unknown): void {
  log.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}

const KEY_OPTION = "--key <key>";
const KEY_HELP = "full-access API key (ctx7sk_…); defaults to TWINMCP_API_KEY or `twinmcp login`";

export function registerHostingCommands(program: Command): void {
  const servers = program.command("servers").alias("server").description("Manage your servers");

  servers
    .command("list")
    .alias("ls")
    .description("List your servers")
    .option(KEY_OPTION, KEY_HELP)
    .option("--json", "print raw JSON")
    .action(async (opts: { key?: string; json?: boolean }) => {
      trackEvent("command", { name: "servers list" });
      try {
        const items = await managementClient(opts.key).listServers();
        if (opts.json) {
          console.log(JSON.stringify(items, null, 2));
          return;
        }
        if (items.length === 0) {
          log.warn("No servers yet. Create one with: twinmcp servers create <name>");
          return;
        }
        const rows = items.map((s) => [
          s.slug,
          s.name,
          s.status,
          s.hostType === "local_agent" ? "local agent" : s.boxSize,
          buildServerUrl(getBaseUrl(), s.slug),
        ]);
        console.log(formatTable(["SLUG", "NAME", "STATUS", "HOST", "URL"], rows));
      } catch (err) {
        fail(err);
      }
    });

  servers
    .command("create <name>")
    .description("Create a server (an isolated runtime, or a local-agent server with --local)")
    .option("--size <size>", `box size: ${BOX_SIZES.join(", ")} (your plan decides which)`)
    .option("--slug <slug>", "URL slug (default: derived from the name)")
    .option("--local", "local-agent server: tools run on your machine via `twinmcp connect`")
    .option(KEY_OPTION, KEY_HELP)
    .option("--json", "print raw JSON")
    .action(
      async (
        name: string,
        opts: { size?: string; slug?: string; local?: boolean; key?: string; json?: boolean }
      ) => {
        trackEvent("command", { name: "servers create" });
        try {
          if (opts.size && !(BOX_SIZES as readonly string[]).includes(opts.size)) {
            throw new Error(`--size must be one of: ${BOX_SIZES.join(", ")}`);
          }
          if (opts.local && opts.size) {
            throw new Error("--size does not apply to a --local server (it hosts no box).");
          }
          if (opts.slug && !isValidSlug(opts.slug)) {
            throw new Error("--slug must be 2-64 characters: lowercase letters, digits, hyphens.");
          }
          const client = managementClient(opts.key);
          const spinner = opts.json ? null : ora("Creating server…").start();
          let created: { id: string; slug: string; status: string };
          try {
            created = await client.createServer({
              name,
              ...(opts.slug ? { slug: opts.slug } : {}),
              ...(opts.local ? { hostType: "local_agent" as const } : {}),
              ...(opts.size ? { boxSize: opts.size as BoxSize } : {}),
            });
          } catch (err) {
            spinner?.fail("Server not created");
            throw err;
          }
          if (opts.json) {
            console.log(JSON.stringify(created, null, 2));
            return;
          }
          spinner?.succeed(`Created ${pc.bold(created.slug)} (${created.status})`);
          log.blank();
          log.plain(`  URL   ${buildServerUrl(getBaseUrl(), created.slug)}`);
          log.blank();
          log.dim("  Next:");
          if (opts.local) {
            log.dim(`    twinmcp mcp install ${created.slug} <local-tool-slug>`);
            log.dim(`    twinmcp connect --server ${created.slug}`);
          } else {
            log.dim(`    twinmcp mcp install ${created.slug} <mcp-slug>`);
            log.dim(`    twinmcp setup --server ${created.slug} --cursor`);
          }
        } catch (err) {
          fail(err);
        }
      }
    );

  const mcp = program.command("mcp").description("Manage the MCPs installed on a server");

  mcp
    .command("list <server>")
    .alias("ls")
    .description("List the MCPs installed on a server (slug or id)")
    .option(KEY_OPTION, KEY_HELP)
    .option("--json", "print raw JSON")
    .action(async (serverRef: string, opts: { key?: string; json?: boolean }) => {
      trackEvent("command", { name: "mcp list" });
      try {
        const client = managementClient(opts.key);
        const server = await client.getServer(serverRef);
        const items = await client.listServerMcps(server.id);
        if (opts.json) {
          console.log(JSON.stringify(items, null, 2));
          return;
        }
        if (items.length === 0) {
          log.warn(`Nothing installed on ${server.slug} yet.`);
          log.dim(`  twinmcp mcp install ${server.slug} <mcp-slug>`);
          return;
        }
        const rows = items.map((m) => [
          m.mcpSlug,
          m.mcpName,
          m.mcpRuntime,
          m.enabled ? "yes" : "no",
          buildServerUrl(getBaseUrl(), server.slug, { mcp: m.mcpSlug }),
        ]);
        console.log(formatTable(["MCP", "NAME", "RUNTIME", "ENABLED", "URL"], rows));
      } catch (err) {
        fail(err);
      }
    });

  mcp
    .command("search [query]")
    .description("Search the catalog for MCPs you can install")
    .option(KEY_OPTION, KEY_HELP)
    .option("--json", "print raw JSON")
    .action(async (query: string | undefined, opts: { key?: string; json?: boolean }) => {
      trackEvent("command", { name: "mcp search" });
      try {
        const items = await managementClient(opts.key).searchCatalog(query);
        if (opts.json) {
          console.log(JSON.stringify(items, null, 2));
          return;
        }
        if (items.length === 0) {
          log.warn(query ? `No MCP matches "${query}".` : "The catalog is empty.");
          return;
        }
        const rows = items.map((m) => [m.slug, m.name, m.runtime ?? ""]);
        console.log(formatTable(["SLUG", "NAME", "RUNTIME"], rows));
      } catch (err) {
        fail(err);
      }
    });

  mcp
    .command("install <server> <mcpSlug>")
    .description("Install a catalog MCP on a server")
    .option(
      "-c, --config <pair...>",
      "config value as KEY=VALUE (repeatable). Values typed here can land in your shell history; omit a secret to be prompted for it"
    )
    .option("-y, --yes", "never prompt (fail on missing required config)")
    .option(KEY_OPTION, KEY_HELP)
    .option("--json", "print raw JSON")
    .action(
      async (
        serverRef: string,
        mcpSlug: string,
        opts: { config?: string[]; yes?: boolean; key?: string; json?: boolean }
      ) => {
        trackEvent("command", { name: "mcp install" });
        try {
          const raw = parseConfigPairs(opts.config);
          const client = managementClient(opts.key);
          const [server, entry] = await Promise.all([
            client.getServer(serverRef),
            client.getCatalogMcp(mcpSlug),
          ]);

          const interactive = !opts.yes && !opts.json && Boolean(process.stdin.isTTY);
          if (interactive) await promptMissingConfig(raw, entry.configSchema);

          const { config, errors, unknown } = coerceConfig(raw, entry.configSchema);
          if (unknown.length > 0) {
            log.warn(`Not in ${entry.slug}'s config schema (sent as-is): ${unknown.join(", ")}`);
          }
          if (errors.length > 0) {
            throw new Error(
              `Cannot install ${entry.slug}: ${errors.join("; ")}.\n` +
                describeSchema(entry.configSchema)
            );
          }

          const spinner = opts.json ? null : ora(`Installing ${entry.name}…`).start();
          let result: { id: string; mcpServerId: string };
          try {
            result = await client.installMcp(server.id, entry.id, config);
          } catch (err) {
            spinner?.fail("Not installed");
            throw err;
          }
          const url = buildServerUrl(getBaseUrl(), server.slug, { mcp: entry.slug });
          if (opts.json) {
            console.log(JSON.stringify({ ...result, url }, null, 2));
            return;
          }
          spinner?.succeed(`Installed ${pc.bold(entry.slug)} on ${pc.bold(server.slug)}`);
          log.plain(`  URL   ${url}`);
          if (server.hostType === "local_agent") {
            log.dim(`  Runs on your machine: twinmcp connect --server ${server.slug}`);
          } else {
            log.dim(
              "  The first install downloads the package into the box; allow about a minute."
            );
          }
        } catch (err) {
          fail(err);
        }
      }
    );

  program
    .command("url <server>")
    .description("Print a server's connection URL (whole server, or one MCP with --mcp)")
    .option("--mcp <slug>", "the URL of one installed MCP instead of the whole server")
    .option("--router", "router mode: search_tools / get_tool_schema / call_tool")
    .action((serverSlug: string, opts: { mcp?: string; router?: boolean }) => {
      trackEvent("command", { name: "url" });
      try {
        if (!isValidSlug(serverSlug)) {
          throw new Error(`"${serverSlug}" is not a server slug (see \`twinmcp servers list\`).`);
        }
        if (opts.mcp && !isValidSlug(opts.mcp)) {
          throw new Error(
            `"${opts.mcp}" is not an MCP slug (see \`twinmcp mcp list ${serverSlug}\`).`
          );
        }
        console.log(buildServerUrl(getBaseUrl(), serverSlug, opts));
        if (process.stdout.isTTY) {
          console.error(pc.dim("Send it with the header  Authorization: Bearer ctx7sk_…"));
          console.error(pc.dim(`Or write it into a client: twinmcp setup --server ${serverSlug}`));
        }
      } catch (err) {
        fail(err);
      }
    });
}

function describeSchema(schema: ConfigSchema | null | undefined): string {
  const entries = Object.entries(schema?.properties ?? {});
  if (entries.length === 0) return "This MCP takes no configuration.";
  const lines = entries.map(
    ([key, def]) =>
      `  ${key}  (${def.type}${def.required ? ", required" : ""}${def.secret ? ", secret" : ""})` +
      (def.description ? `  ${def.description}` : "")
  );
  return ["Config keys:", ...lines, "Pass them with --config KEY=VALUE."].join("\n");
}

/** Asks for each required key the user left out (masked when secret). */
async function promptMissingConfig(
  raw: Record<string, string>,
  schema: ConfigSchema | null | undefined
): Promise<void> {
  for (const [key, def] of Object.entries(schema?.properties ?? {})) {
    if (!def.required || (raw[key] !== undefined && raw[key] !== "")) continue;
    const message = `${key}${def.description ? ` (${def.description})` : ""}`;
    const value: ConfigValue = def.secret
      ? await password({ message, mask: "*" })
      : await input({ message });
    raw[key] = String(value);
  }
}
