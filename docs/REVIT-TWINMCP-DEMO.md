# Revit × TwinMCP — the "one URL, one key" demo

Two ways to demo the Revit connector:

- **Simple / standalone** — configure Claude Desktop directly on the machine.
  See [`revit-mcp/README.md`](../revit-mcp/README.md) (`install.ps1`). Best for a
  quick proof on your own laptop.
- **Product flow (this doc)** — through **TwinMCP**: the client points their LLM
  at **one TwinMCP URL with one key**, and the Revit tool runs locally on their
  machine via the agent. This is the story to sell: governance, per-user keys,
  audit, and the model never leaving their network.

The `revit` connector is now in the catalog as a **local** MCP (`hostMode:
"local"`), alongside Blender.

---

## The flow (product demo)

**1. Create a local-agent server** — Dashboard → Servers → New → host type
**"Local (via agent)"**. Note its **slug**.

**2. Install the Revit connector** — Marketplace → **Revit** → install onto that
server. Leave the config empty for the **demo** model, or set
`REVIT_MCP_MODE=live` (+ `REVIT_HOST`, `REVIT_PORT`) to talk to a real Revit.

**3. Get the URL + key** — on the server's **Connect** panel, copy the **proxy
URL** and **generate an API key** (`ctx7sk_…`).

**4. Run the agent on the client's machine** (where Revit + `uv` are):

```powershell
npx ctx7@latest connect --server <slug> --key ctx7sk_…
```

The agent starts `revit-mcp` locally (`uvx …`) and relays it to TwinMCP over a
persistent link. Leave it running during the demo.

> From the repo instead of npm (until the `connect` release is published):
> `pnpm --filter ctx7 build` then
> `node packages/cli/dist/index.js connect --server <slug> --key ctx7sk_…`.

**5. Point the LLM at TwinMCP** — put the **proxy URL + key** into Claude / Cursor
(exactly as shown in the Connect panel). Ask the Bulgarian demo questions — the
requests travel: LLM → TwinMCP proxy → agent on the client's machine → `revit-mcp`
→ back. **One URL, one key.**

---

## Requirements on the client's machine

- **`uv`** installed (the connector runs via `uvx`). One line:
  `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`.
- For **live** mode: Revit open with the **pyRevit listener** running
  (`revit_listener.py`), and the config set to `REVIT_MCP_MODE=live`.
- The catalog `startCmd` installs the connector from the repo
  (`uvx --from git+…#subdirectory=revit-mcp revit-mcp`). If the repo is private,
  publish `revit-mcp` to PyPI (then `startCmd: "uvx revit-mcp"`) or point the
  startCmd at a local checkout.

---

## Why this beats a plain Claude Desktop config (for the pitch)

- **One URL, one key** for the whole firm — not per-machine JSON.
- **Per-user API keys + audit logs** — you see who accessed what.
- **The model stays on their machine** — the agent runs the tool locally; only
  results are relayed.
- Same account can later add more connectors (docs, project management, web)
  behind the same URL.
