/**
 * The TwinMCP CLI, as the app prints it. One place for the package name so no
 * page tells a user to run `npx ctx7` (that installs Upstash's Context7 CLI,
 * which has no `connect` command).
 *
 * The package is packages/cli (bin `twinmcp`). Its `connect` command takes
 * `--server <slug>` (required) and `--key <key>` (optional; it falls back to
 * TWINMCP_API_KEY or the key saved by `twinmcp login`).
 *
 * NEXT_PUBLIC_TWINMCP_CLI_PACKAGE overrides the package (e.g. a pinned
 * version or a fork); it is inlined at build time.
 */
export const CLI_PACKAGE: string =
  process.env.NEXT_PUBLIC_TWINMCP_CLI_PACKAGE?.trim() || "@twinmcp/cli";

/** Any CLI invocation: `npx -y @twinmcp/cli <args>`. Empty args are dropped. */
export function cliCommand(...args: Array<string | undefined | null | false>): string {
  const rest = args.filter((a): a is string => typeof a === "string" && a.trim() !== "");
  return ["npx", "-y", CLI_PACKAGE, ...rest].join(" ");
}

/**
 * The command that brings a Local (agent) server online on the user's machine:
 * `npx -y @twinmcp/cli connect --server <slug>`, plus `--key <key>` when one is
 * given (the CLI otherwise reads TWINMCP_API_KEY or the `twinmcp login` key).
 */
export function localAgentCommand(serverSlug: string, apiKey?: string | null): string {
  return cliCommand("connect", "--server", serverSlug, apiKey ? `--key ${apiKey}` : undefined);
}
