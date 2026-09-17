# revit-mcp — Claude × Revit

An MCP server that lets Claude query a **Revit BIM model** in natural language —
element queries, quantities (take-offs), fire-rating QA and accessibility checks.

It has two modes:

- **`demo`** (default) — a realistic sample office building is baked in. **Works
  with no Revit install** → perfect for a live sales demo.
- **`live`** — reads the real model from a listener running inside Revit (see
  [`revit_listener.py`](./revit_listener.py)) over a local socket.

The tools work identically in both modes.

---

## ⚡ Fastest demo (no Revit needed) — Claude Desktop

**1. Install [`uv`](https://docs.astral.sh/uv/)** (one line, handles Python +
deps automatically):

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**2. Point Claude Desktop at the server.** Edit
`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "revit": {
      "command": "uvx",
      "args": ["--from", "C:\\Users\\sofia\\Desktop\\TwinMCP-master\\revit-mcp", "revit-mcp"],
      "env": { "REVIT_MCP_MODE": "demo" }
    }
  }
}
```

(Fallback without uv: `"command": "python", "args": ["-m", "revit_mcp"], "cwd":
"…\\revit-mcp"` after `pip install mcp` in that Python.)

**3. Restart Claude Desktop.** You'll see a 🔌 **revit** tool. Done.

---

## 🎬 Demo script (in Bulgarian, matches the pitch deck)

Ask Claude these — it calls the Revit tools and answers from the model:

1. **„Дай ми обобщение на проекта.“** → `project_summary`
2. **„Колко пожарни врати има на ниво 3?“** → `query_elements(Doors, L3)`
3. **„Кои стени нямат зададена пожароустойчивост?“** → `check_fire_ratings`
4. **„Дай количествата на вратите и прозорците по нива.“** → `get_quantities`
5. **„Кои врати не отговарят на изискванията за достъпност (мин. 900 мм)?“** → `check_accessibility`
6. **„Направи списък за контрол на качеството преди предаване.“** → Claude combines the checks

The sample model deliberately contains **3 walls without a fire rating** and **2
doors below 900 mm**, so the QA/accessibility answers are non-trivial and
convincing.

> Tip: keep the model dict in [`revit_mcp/model.py`](./revit_mcp/model.py) open
> on a second screen — "this is your model's data" lands well.

---

## 🧰 Tools

| Tool | What it does |
| --- | --- |
| `project_summary()` | Name, levels, element counts per category, total room area |
| `list_levels()` | Building levels with elevations |
| `query_elements(category?, level?)` | Filtered element list with parameters |
| `get_quantities(category, group_by="level")` | Bill of quantities / take-off |
| `check_fire_ratings()` | Walls & doors missing a fire rating |
| `check_accessibility(min_door_width_mm=900)` | Doors below the min clear width |
| `get_element(element_id)` | Full details of one element |

Verify the data with no MCP client at all:

```powershell
cd revit-mcp
python -m revit_mcp --selftest
```

---

## 🏗️ Live mode (real Revit model)

1. Open your project in **Revit** and run [`revit_listener.py`](./revit_listener.py)
   from **pyRevit** (it opens a socket on `127.0.0.1:8765` and reads the model
   via the Revit API). Adapt the parameter names to your template.
2. Switch the MCP server to live mode:

   ```json
   "env": { "REVIT_MCP_MODE": "live", "REVIT_HOST": "127.0.0.1", "REVIT_PORT": "8765" }
   ```

Same questions, now answered from the client's real model — and the data never
leaves their machine.

---

## 🔗 Via TwinMCP (the product path)

To deliver this to the client through TwinMCP (one URL, one key, per-user access,
audit) instead of a local Claude Desktop config:

1. Publish `revit-mcp` (so `uvx revit-mcp` resolves), then add a catalog entry
   with `hostMode: "local"`, `runtime: "python"`, `startCmd: "uvx revit-mcp"`.
2. On the client's machine (where Revit runs), start the local agent:
   `ctx7 connect --server <slug>`. It relays this local MCP to the TwinMCP proxy.
3. Point the client's Claude/Cursor at the TwinMCP proxy URL + their key.

This is the same local-agent pattern already proven for other desktop design
tools — the Revit data stays on the client's network, relayed securely.

---

_Part of TwinMCP · a Revit-optimised MCP connector._
