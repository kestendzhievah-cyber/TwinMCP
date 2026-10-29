import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { select } from "@inquirer/prompts";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { log } from "../utils/logger.js";
import { checkboxWithHover } from "../utils/prompts.js";
import { trackEvent } from "../utils/tracking.js";
import { getBaseUrl, downloadSkill } from "../utils/api.js";
import { installSkillFiles } from "../utils/installer.js";
import { performLogin } from "./auth.js";
import { saveTokens, getValidAccessToken } from "../utils/auth.js";
import {
  type SetupAgent,
  type AuthOptions,
  SETUP_AGENT_NAMES,
  AUTH_MODE_LABELS,
  ALL_AGENT_NAMES,
  getAgent,
  detectAgents,
} from "../setup/agents.js";
import { customizeSkillFilesForAgent, getRuleContent, SKILLS_PROJECT } from "../setup/templates.js";
import {
  readJsonConfig,
  mergeServerEntry,
  writeJsonConfig,
  resolveMcpPath,
  appendTomlServer,
} from "../setup/mcp-writer.js";
import { managementClient } from "./hosting.js";
import {
  NO_KEY_MESSAGE,
  buildServerUrl,
  isApiKey,
  isValidSlug,
  serverEntryLabel,
  type HostedServer,
  type HostingClient,
} from "../utils/hosting.js";

type Scope = "global" | "project";
type SetupMode = "mcp" | "cli";

interface SetupOptions {
  claude?: boolean;
  cursor?: boolean;
  universal?: boolean;
  antigravity?: boolean;
  opencode?: boolean;
  codex?: boolean;
  gemini?: boolean;
  project?: boolean;
  yes?: boolean;
  apiKey?: string;
  oauth?: boolean;
  cli?: boolean;
  mcp?: boolean;
  server?: string;
  router?: boolean;
}

const CHECKBOX_THEME = {
  style: {
    highlight: (text: string) => pc.green(text),
    disabledChoice: (text: string) => ` ${pc.dim("◯")} ${pc.dim(text)}`,
  },
};

function getSelectedAgents(options: SetupOptions): SetupAgent[] {
  const agents: SetupAgent[] = [];
  if (options.claude) agents.push("claude");
  if (options.cursor) agents.push("cursor");
  if (options.opencode) agents.push("opencode");
  if (options.codex) agents.push("codex");
  if (options.gemini) agents.push("gemini");
  return agents;
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Set up TwinMCP for your AI coding agent")
    .option("--claude", "Set up for Claude Code")
    .option("--cursor", "Set up for Cursor")
    .option("--universal", "Set up for Universal (.agents/skills)")
    .option("--antigravity", "Set up for Antigravity (.agent/skills)")
    .option("--opencode", "Set up for OpenCode")
    .option("--codex", "Set up for Codex")
    .option("--gemini", "Set up for Gemini CLI")
    .option("--server <slug>", "Connect this TwinMCP server (default: pick one of yours)")
    .option("--router", "Use the server's router mode (search_tools / call_tool)")
    .option("--mcp", "Set up MCP server mode")
    .option("--cli", "Set up CLI + Skills mode (no MCP server)")
    .option("-p, --project", "Configure for current project instead of globally")
    .option("-y, --yes", "Skip confirmation prompts")
    .option(
      "--api-key <key>",
      "Write this key into the client config instead of minting a key bound to the server"
    )
    .option("--oauth", "Write the URL without a key; the client signs in with MCP OAuth")
    .action(async (options: SetupOptions) => {
      await setupCommand(options);
    });
}

/** A management client, logging in first when no key is stored yet. */
async function ensureManagementClient(): Promise<HostingClient | null> {
  try {
    return managementClient();
  } catch (err) {
    if (!(err instanceof Error) || err.message !== NO_KEY_MESSAGE) throw err;
  }
  const key = await performLogin();
  return key ? managementClient() : null;
}

/** The server to connect: --server, the only one there is, or a prompt. */
async function pickServer(client: HostingClient, options: SetupOptions): Promise<HostedServer> {
  if (options.server) return client.getServer(options.server);

  const servers = (await client.listServers()).filter((s) => s.status !== "destroyed");
  if (servers.length === 0) {
    throw new Error("You have no server yet. Create one first: twinmcp servers create <name>");
  }
  if (servers.length === 1) return servers[0];
  if (options.yes) {
    throw new Error(
      `Several servers: pass --server <slug> (one of: ${servers.map((s) => s.slug).join(", ")}).`
    );
  }
  return select<HostedServer>({
    message: "Which server should your agents connect to?",
    choices: servers.map((s) => ({
      name: `${s.slug}  ${pc.dim(`${s.name} · ${s.status}`)}`,
      value: s,
    })),
    theme: { style: { highlight: (text: string) => pc.green(text) } },
  });
}

/**
 * Where the client connects and with which credential. A key is minted for
 * the server (scope mcp_proxy) unless the user brings one or picks OAuth, so
 * the config files never hold a key that can manage the account.
 */
async function resolveServerTarget(
  options: SetupOptions,
  agents: SetupAgent[]
): Promise<{ slug: string; auth: AuthOptions; minted: boolean } | null> {
  if (options.apiKey && !isApiKey(options.apiKey)) {
    throw new Error("--api-key must be a TwinMCP API key (ctx7sk_…).");
  }
  if (options.server && !isValidSlug(options.server)) {
    throw new Error(`"${options.server}" is not a server slug (see: twinmcp servers list).`);
  }

  // With a slug and the user's own credential there is nothing to look up.
  if (options.server && (options.oauth || options.apiKey)) {
    const url = buildServerUrl(getBaseUrl(), options.server, { router: options.router });
    return {
      slug: options.server,
      auth: options.oauth
        ? { mode: "oauth", url }
        : { mode: "api-key", apiKey: options.apiKey, url },
      minted: false,
    };
  }

  const client = await ensureManagementClient();
  if (!client) return null;
  const server = await pickServer(client, options);
  const url = buildServerUrl(getBaseUrl(), server.slug, { router: options.router });

  if (options.oauth) return { slug: server.slug, auth: { mode: "oauth", url }, minted: false };
  if (options.apiKey) {
    return {
      slug: server.slug,
      auth: { mode: "api-key", apiKey: options.apiKey, url },
      minted: false,
    };
  }

  const spinner = ora(`Creating a key for ${server.slug}...`).start();
  try {
    const names = agents.map((a) => SETUP_AGENT_NAMES[a]).join(", ");
    const created = await client.createProxyKey(server.id, `CLI setup (${names})`);
    spinner.succeed(`Created a key that can only call ${server.slug}`);
    return { slug: server.slug, auth: { mode: "api-key", apiKey: created.key, url }, minted: true };
  } catch (err) {
    spinner.fail("Could not create a key");
    throw err;
  }
}

async function resolveMode(options: SetupOptions): Promise<SetupMode> {
  if (options.cli) return "cli";
  if (options.server || options.mcp || options.yes || options.oauth || options.apiKey) {
    return "mcp";
  }

  return select<SetupMode>({
    message: "How should your agent access TwinMCP?",
    choices: [
      {
        name: `MCP server\n    ${pc.dim("Agent connects to one of your TwinMCP servers over MCP (every installed tool)")}`,
        value: "mcp" as SetupMode,
      },
      {
        name: `CLI + Skills\n    ${pc.dim("Installs a find-docs skill that guides your agent to fetch up-to-date library docs using ")}${pc.dim(pc.bold("twinmcp"))}${pc.dim(" CLI commands")}`,
        value: "cli" as SetupMode,
      },
    ],
    theme: {
      style: {
        highlight: (text: string) => pc.green(text),
        answer: (text: string) => pc.green(text.split("\n")[0].trim()),
      },
    },
  });
}

async function resolveCliAuth(apiKey?: string): Promise<void> {
  if (apiKey) {
    saveTokens({ access_token: apiKey, token_type: "bearer" });
    log.blank();
    log.plain(`${pc.green("✔")} Authenticated`);
    return;
  }

  const validToken = await getValidAccessToken();
  if (validToken) {
    log.blank();
    log.plain(`${pc.green("✔")} Authenticated`);
    return;
  }

  await performLogin();
}

async function promptAgents(): Promise<SetupAgent[] | null> {
  const choices = ALL_AGENT_NAMES.map((name) => ({
    name: SETUP_AGENT_NAMES[name],
    value: name,
  }));

  const message = "Which agents do you want to set up?";

  try {
    return await checkboxWithHover(
      {
        message,
        choices,
        loop: false,
        theme: CHECKBOX_THEME,
      },
      { getName: (a: SetupAgent) => SETUP_AGENT_NAMES[a] }
    );
  } catch {
    return null;
  }
}

async function resolveAgents(options: SetupOptions, scope: Scope): Promise<SetupAgent[]> {
  const explicit = getSelectedAgents(options);
  if (explicit.length > 0) return explicit;

  const detected = await detectAgents(scope);

  if (detected.length > 0 && options.yes) return detected;

  log.blank();
  const selected = await promptAgents();
  if (!selected) {
    log.warn("Setup cancelled");
    return [];
  }
  return selected;
}

/** Install a rule for an agent, handling both "file" (standalone) and "append" (AGENTS.md) types. */
async function installRule(
  agentName: SetupAgent,
  mode: SetupMode,
  scope: Scope
): Promise<{ status: string; path: string }> {
  const agent = getAgent(agentName);
  const rule = agent.rule;
  const content = await getRuleContent(mode, agentName);

  if (rule.kind === "file") {
    const ruleDir =
      scope === "global" ? rule.dir("global") : join(process.cwd(), rule.dir("project"));
    const rulePath = join(ruleDir, rule.filename);
    await mkdir(dirname(rulePath), { recursive: true });
    await writeFile(rulePath, content, "utf-8");
    return { status: "installed", path: rulePath };
  }

  const filePath =
    scope === "global" ? rule.file("global") : join(process.cwd(), rule.file("project"));
  const escapedMarker = rule.sectionMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = `${rule.sectionMarker}\n${content}${rule.sectionMarker}`;

  let existing = "";
  try {
    existing = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  if (existing.includes(rule.sectionMarker)) {
    const regex = new RegExp(`${escapedMarker}\\n[\\s\\S]*?${escapedMarker}`);
    const updated = existing.replace(regex, section);
    await writeFile(filePath, updated, "utf-8");
    return { status: "updated", path: filePath };
  }

  const separator =
    existing.length > 0 && !existing.endsWith("\n") ? "\n\n" : existing.length > 0 ? "\n" : "";
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, existing + separator + section + "\n", "utf-8");
  return { status: "installed", path: filePath };
}

async function setupAgent(
  agentName: SetupAgent,
  auth: AuthOptions,
  scope: Scope,
  label: string
): Promise<{ agent: string; mcpStatus: string; mcpPath: string }> {
  const agent = getAgent(agentName);

  const mcpCandidates =
    scope === "global"
      ? agent.mcp.globalPaths
      : agent.mcp.projectPaths.map((p) => join(process.cwd(), p));
  const mcpPath = await resolveMcpPath(mcpCandidates);

  let mcpStatus: string;
  try {
    const entry = agent.mcp.buildEntry(auth);
    let alreadyExists: boolean;
    if (mcpPath.endsWith(".toml")) {
      ({ alreadyExists } = await appendTomlServer(mcpPath, label, entry));
    } else {
      const existing = await readJsonConfig(mcpPath);
      const merged = mergeServerEntry(existing, agent.mcp.configKey, label, entry);
      alreadyExists = merged.alreadyExists;
      await writeJsonConfig(mcpPath, merged.config);
    }
    mcpStatus = `${alreadyExists ? "reconfigured" : "configured"} with ${AUTH_MODE_LABELS[auth.mode]}`;
  } catch (err) {
    mcpStatus = `failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return { agent: agent.displayName, mcpStatus, mcpPath };
}

async function setupMcp(agents: SetupAgent[], options: SetupOptions, scope: Scope): Promise<void> {
  let target: Awaited<ReturnType<typeof resolveServerTarget>>;
  try {
    target = await resolveServerTarget(options, agents);
  } catch (err) {
    if (err instanceof Error && err.name === "ExitPromptError") throw err;
    log.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  if (!target) {
    log.warn("Setup cancelled");
    return;
  }

  const label = serverEntryLabel(target.slug);
  log.blank();
  const spinner = ora("Writing client configs...").start();

  const results = [];
  for (const agentName of agents) {
    spinner.text = `Setting up ${getAgent(agentName).displayName}...`;
    results.push(await setupAgent(agentName, target.auth, scope, label));
  }

  const failed = results.filter((r) => r.mcpStatus.startsWith("failed"));
  if (failed.length === results.length) spinner.fail("Setup failed");
  else spinner.succeed(`${label} added`);

  log.blank();
  log.plain(`  ${pc.dim("URL")}  ${target.auth.url}`);
  log.blank();
  for (const r of results) {
    const ok = !r.mcpStatus.startsWith("failed");
    log.plain(`  ${pc.bold(r.agent)}`);
    log.plain(`    ${ok ? pc.green("+") : pc.red("x")} MCP server ${r.mcpStatus}`);
    log.plain(`      ${pc.dim(r.mcpPath)}`);
  }
  log.blank();
  if (target.minted) {
    log.dim(
      "  The key written above can only call this server. Revoke it in the dashboard anytime."
    );
  }
  log.dim("  Restart the client so it reloads its MCP config.");
  log.blank();
  if (failed.length > 0) process.exitCode = 1;

  trackEvent("setup", { agents, scope, authMode: target.auth.mode, mode: "server" });
}

async function setupCliAgent(
  agentName: SetupAgent,
  scope: Scope,
  downloadData: { files: Array<{ path: string; content: string }> }
): Promise<{ skillPath: string; skillStatus: string; rulePath: string; ruleStatus: string }> {
  const agent = getAgent(agentName);

  const skillDir =
    scope === "global"
      ? agent.skill.dir("global")
      : join(process.cwd(), agent.skill.dir("project"));
  let skillStatus: string;
  try {
    const files = customizeSkillFilesForAgent(agentName, "find-docs", downloadData.files);
    await installSkillFiles("find-docs", files, skillDir);
    skillStatus = "installed";
  } catch (err) {
    skillStatus = `failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  const skillPath = join(skillDir, "find-docs");

  let ruleStatus: string;
  let rulePath: string;
  try {
    const result = await installRule(agentName, "cli", scope);
    ruleStatus = result.status;
    rulePath = result.path;
  } catch (err) {
    ruleStatus = `failed: ${err instanceof Error ? err.message : String(err)}`;
    rulePath = "";
  }

  return { skillPath, skillStatus, rulePath, ruleStatus };
}

async function setupCli(options: SetupOptions): Promise<void> {
  await resolveCliAuth(options.apiKey);

  const scope: Scope = options.project ? "project" : "global";
  const agents = await resolveAgents(options, scope);
  if (agents.length === 0) return;

  log.blank();
  const spinner = ora("Downloading find-docs skill...").start();

  const downloadData = await downloadSkill(SKILLS_PROJECT, "find-docs");
  if (downloadData.error || downloadData.files.length === 0) {
    spinner.fail(`Failed to download find-docs skill: ${downloadData.error || "no files"}`);
    return;
  }

  spinner.succeed("Downloaded find-docs skill");

  const installSpinner = ora("Installing...").start();
  const results: Array<{
    agent: string;
    skillPath: string;
    skillStatus: string;
    rulePath: string;
    ruleStatus: string;
  }> = [];

  for (const agentName of agents) {
    installSpinner.text = `Setting up ${getAgent(agentName).displayName}...`;
    const r = await setupCliAgent(agentName, scope, downloadData);
    results.push({ agent: getAgent(agentName).displayName, ...r });
  }

  installSpinner.succeed("TwinMCP CLI setup complete");

  log.blank();
  for (const r of results) {
    log.plain(`  ${pc.bold(r.agent)}`);
    const skillIcon = r.skillStatus === "installed" ? pc.green("+") : pc.dim("~");
    log.plain(`    ${skillIcon} Skill ${r.skillStatus}`);
    log.plain(`      ${pc.dim(r.skillPath)}`);
    if (r.skillStatus.includes("EACCES")) {
      log.plain(
        `      ${pc.yellow("tip:")} fix permissions with: ${pc.cyan(`sudo chown -R $(whoami) ${dirname(dirname(r.skillPath))}`)}`
      );
    }
    const ruleIcon =
      r.ruleStatus === "installed" || r.ruleStatus === "updated" ? pc.green("+") : pc.dim("~");
    log.plain(`    ${ruleIcon} Rule ${r.ruleStatus}`);
    log.plain(`      ${pc.dim(r.rulePath)}`);
  }
  log.blank();

  trackEvent("setup", { mode: "cli" });
  trackEvent("install", { skills: [`${SKILLS_PROJECT}/find-docs`], ides: agents });
}

async function setupCommand(options: SetupOptions): Promise<void> {
  trackEvent("command", { name: "setup" });

  try {
    const mode = await resolveMode(options);
    if (mode === "mcp") {
      const scope: Scope = options.project ? "project" : "global";
      const agents = await resolveAgents(options, scope);
      if (agents.length === 0) return;
      await setupMcp(agents, options, scope);
    } else {
      await setupCli(options);
    }
  } catch (err) {
    // Ctrl+C in a prompt: leave quietly (no process.exit, see commands/auth.ts).
    if (err instanceof Error && err.name === "ExitPromptError") return;
    throw err;
  }
}
