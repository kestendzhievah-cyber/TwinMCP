# @twinmcp/cli

Command line for [TwinMCP](https://twinmcp.fr): create servers, install MCPs from the catalog,
connect AI clients to them, and run local tools through a local-agent server.

## Install

```bash
npm install -g @twinmcp/cli     # gives you the `twinmcp` command
# or, without installing:
npx @twinmcp/cli --help
```

Node.js 18 or later. The command is `twinmcp`. (`ctx7` on npm is a different, unrelated package.)

## Log in

The management commands use a **full-access** API key (`ctx7sk_…`). Create one in the dashboard
(API keys panel on [twinmcp.fr/dashboard](https://twinmcp.fr/dashboard)), then:

```bash
twinmcp login                       # opens the dashboard and asks you to paste the key
twinmcp login --key ctx7sk_…        # non-interactive
twinmcp whoami
twinmcp logout
```

The key is stored in `~/.twinmcp/credentials.json` (`%USERPROFILE%\.twinmcp` on Windows). Every
command also accepts `--key`, and `TWINMCP_API_KEY` overrides the stored key. A key bound to a
single server (scope `mcp_proxy`) can call that server's MCPs but cannot manage anything; the CLI
says so when it gets one.

## Servers and MCPs

```bash
twinmcp servers list
twinmcp servers create "My tools"               # isolated runtime; --size small|medium|large
twinmcp servers create "My desktop" --local     # local-agent server (see `connect`)

twinmcp mcp search brave
twinmcp mcp install my-tools fetch
twinmcp mcp install my-tools brave-search --config BRAVE_API_KEY=…
twinmcp mcp list my-tools
```

`--config KEY=VALUE` can be repeated; values are converted to the types the catalog entry declares.
Leave a required secret out to be prompted for it (masked) instead of typing it into your shell
history; `--yes` disables prompts. Box sizes and the number of servers depend on your plan, and the
API's own message is shown when a request goes beyond it.

## Connect an AI client

```bash
twinmcp setup --server my-tools --cursor          # also: --claude --codex --gemini --opencode
twinmcp setup --server my-tools --claude --router
twinmcp setup --server my-tools --cursor --project
```

`setup` creates a new key bound to that server (scope `mcp_proxy`) and writes the server URL with
`Authorization: Bearer <key>` into each client's MCP config, under the name `twinmcp-<server>`.
Your full-access key never lands in a config file. Without `--server` it uses your only server or
asks which one. `--api-key ctx7sk_…` writes a key you already have instead; `--oauth` writes the
URL alone for clients that sign in with MCP OAuth. Restart the client afterwards.

To paste a URL yourself:

```bash
twinmcp url my-tools                 # https://twinmcp.fr/api/mcp/my-tools (every MCP of the server)
twinmcp url my-tools --router        # …?mode=router (search_tools, get_tool_schema, call_tool)
twinmcp url my-tools --mcp fetch     # one MCP only
```

## Local tools (`connect`)

Tools that must run on your own machine (for example Blender) go on a local-agent server.
`connect` keeps a link open to TwinMCP, starts each local tool installed on that server, and relays
calls to them:

```bash
twinmcp connect --server my-desktop
```

Stop it with Ctrl+C (Ctrl+Break also works on Windows); the tools it started are stopped with it.

## Library documentation

```bash
twinmcp library react "how to use hooks"
twinmcp docs /facebook/react "useEffect cleanup"
twinmcp docs /facebook/react "hooks" --json
```

## Options

- `--base-url <url>` targets another TwinMCP deployment (default `https://twinmcp.fr`).
- `TWINMCP_TELEMETRY_DISABLED=1` turns off the anonymous command events the CLI sends.

## Development

```bash
pnpm --filter @twinmcp/cli build
pnpm --filter @twinmcp/cli test
node packages/cli/dist/index.js --help
```

## License

MIT
