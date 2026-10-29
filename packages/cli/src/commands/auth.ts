import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import open from "open";
import { password } from "@inquirer/prompts";
import { saveTokens, clearTokens, getValidAccessToken } from "../utils/auth.js";

import { trackEvent } from "../utils/tracking.js";
import { getBaseUrl } from "../utils/api.js";
import { API_KEY_PREFIX, ApiError, HostingClient, isApiKey, maskKey } from "../utils/hosting.js";

// Login stores a full-access TwinMCP API key (ctx7sk_…) in
// ~/.twinmcp/credentials.json. The management API (/api/v2) authenticates
// with such a key only — TwinMCP's OAuth server issues MCP-scoped tokens for
// remote connectors, which cannot manage servers.

/** @deprecated The base URL now comes from `--base-url` via utils/api. Kept for callers. */
export function setAuthBaseUrl(_url: string): void {}

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Log in to TwinMCP with a full-access API key")
    .option("--key <key>", "the API key (ctx7sk_…) — skips the prompt")
    .option("--no-browser", "Don't open the dashboard in a browser")
    .action(async (options: { key?: string; browser: boolean }) => {
      await loginCommand(options);
    });

  program
    .command("logout")
    .description("Log out of TwinMCP (forget the stored API key)")
    .action(() => {
      logoutCommand();
    });

  program
    .command("whoami")
    .description("Show current login status")
    .action(async () => {
      await whoamiCommand();
    });
}

function dashboardUrl(): string {
  return `${getBaseUrl().replace(/\/+$/, "")}/dashboard`;
}

/**
 * Checks the key against the management API and stores it. Returns the key,
 * or null (with the reason printed) when TwinMCP refuses it.
 */
export async function verifyAndSaveKey(key: string): Promise<string | null> {
  if (!isApiKey(key)) {
    console.error(pc.red(`That is not a TwinMCP API key (they start with ${API_KEY_PREFIX}).`));
    return null;
  }
  const spinner = ora("Checking the key...").start();
  try {
    await new HostingClient(getBaseUrl(), key).listServers();
    saveTokens({ access_token: key, token_type: "api_key" });
    spinner.succeed(pc.green(`Logged in with ${maskKey(key)}`));
    return key;
  } catch (error) {
    spinner.fail(pc.red("Login failed"));
    console.error(pc.red(error instanceof Error ? error.message : String(error)));
    return null;
  }
}

/**
 * Interactive login: opens the dashboard, where the API keys panel creates a
 * key, and asks for it. Returns the stored key, or null.
 */
export async function performLogin(openBrowser = true): Promise<string | null> {
  const url = dashboardUrl();
  console.log("");
  console.log(pc.bold("Log in to TwinMCP"));
  console.log(pc.dim(`Create a full-access API key in the dashboard (API keys): ${url}`));
  console.log("");

  if (!process.stdin.isTTY) {
    console.error(pc.red("No terminal to paste the key into. Run: twinmcp login --key ctx7sk_…"));
    return null;
  }

  if (openBrowser) {
    await open(url).catch(() => {});
  }

  let key: string;
  try {
    key = await password({
      message: "Paste your API key",
      mask: "*",
      validate: (value) =>
        isApiKey(value.trim()) || `TwinMCP API keys start with ${API_KEY_PREFIX}`,
    });
  } catch {
    return null; // prompt cancelled (Ctrl+C)
  }
  return verifyAndSaveKey(key.trim());
}

// Failures set process.exitCode instead of calling process.exit(): on Windows
// (Node 24) exiting right after a fetch aborts with a libuv assertion and
// exit code 127.
async function loginCommand(options: { key?: string; browser: boolean }): Promise<void> {
  trackEvent("command", { name: "login" });

  if (options.key) {
    const saved = await verifyAndSaveKey(options.key.trim());
    if (!saved) process.exitCode = 1;
    return;
  }

  const existingToken = await getValidAccessToken();
  if (existingToken && isApiKey(existingToken)) {
    console.log(pc.yellow(`You are already logged in (${maskKey(existingToken)}).`));
    console.log(pc.dim("Run 'twinmcp logout' first if you want to use a different key."));
    return;
  }
  clearTokens();

  const token = await performLogin(options.browser);
  if (!token) {
    process.exitCode = 1;
    return;
  }
  console.log("");
  console.log(pc.dim("Try: twinmcp servers list"));
}

function logoutCommand(): void {
  trackEvent("command", { name: "logout" });
  if (clearTokens()) {
    console.log(pc.green("Logged out successfully."));
  } else {
    console.log(pc.yellow("You are not logged in."));
  }
}

async function whoamiCommand(): Promise<void> {
  trackEvent("command", { name: "whoami" });
  const envKey = process.env.TWINMCP_API_KEY;
  const stored = await getValidAccessToken();
  const key = isApiKey(envKey) ? envKey : isApiKey(stored) ? stored : null;

  if (!key) {
    console.log(pc.yellow("Not logged in."));
    console.log(pc.dim("Run 'twinmcp login' to authenticate."));
    return;
  }

  console.log(pc.green("Logged in"));
  console.log(
    `${pc.dim("Key:".padEnd(13))}${maskKey(key)}${key === envKey ? " (TWINMCP_API_KEY)" : ""}`
  );
  console.log(`${pc.dim("API:".padEnd(13))}${getBaseUrl()}`);

  try {
    const servers = await new HostingClient(getBaseUrl(), key).listServers();
    console.log(`${pc.dim("Servers:".padEnd(13))}${servers.length}`);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Could not reach TwinMCP.";
    console.log(pc.dim(message));
  }
}
