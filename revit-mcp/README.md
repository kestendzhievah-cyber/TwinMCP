# revit-mcp — Claude × Revit

An MCP server that lets Claude query a **Revit BIM model** in natural language —
element queries, quantities (take-offs), fire-rating QA and accessibility checks.

Two modes:

- **`demo`** (default) — a realistic sample office building is baked in. **Works
  with no Revit install** → ready for a live demo.
- **`live`** — reads the real model from a listener inside Revit
  ([`revit_listener.py`](./revit_listener.py)) over a local socket. Data never
  leaves the machine.

---

## ⚡ Install in one command (on the client's machine)

From the `revit-mcp` folder, in PowerShell:

**Demo (no Revit needed):**

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**Live (real Revit model):**

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Mode live
```

That's it. The script:

1. installs [`uv`](https://docs.astral.sh/uv/) if it's missing,
2. **auto-configures Claude Desktop for you** (writes the config, merges with any
   existing servers, keeps a backup).

Then **restart Claude Desktop and just prompt it** about the model — no JSON to
edit, nothing else to launch. (In live mode, do one extra thing: start the
listener inside Revit — the script prints the exact line.)

> Already have `uv`? The whole install is a single command:
> `uvx --from . revit-mcp configure` (add `--mode live` for the real model).

---

## 🎬 Demo script (Bulgarian — matches the pitch deck)

Once Claude Desktop is restarted, just ask (it calls the Revit tools and answers
from the model):

1. **„Дай ми обобщение на проекта.“**
2. **„Колко пожарни врати има на ниво 3?“**
3. **„Кои стени нямат зададена пожароустойчивост?“**
4. **„Дай количествата на вратите и прозорците по нива.“**
5. **„Кои врати не отговарят на изискванията за достъпност (мин. 900 мм)?“**
6. **„Направи списък за контрол на качеството преди предаване.“**

The sample model has deliberate gaps — **3 walls without a fire rating** and **2
doors below 900 mm** — so the QA/accessibility answers are non-trivial.

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

Verify the data with no Claude / MCP client at all:

```powershell
uvx --from . revit-mcp --selftest
```

---

## 🏗️ Live mode (real Revit model)

`install.ps1 -Mode live` configures Claude Desktop for live mode. Then, on the
machine where Revit runs:

1. Open the project in **Revit** and start the listener from the **pyRevit**
   console (it opens a socket on `127.0.0.1:8765` and reads the model via the
   Revit API):

   ```python
   exec(open(r"C:\path\to\revit-mcp\revit_listener.py").read())
   ```

2. Ask Claude the same questions — now answered from the client's real model.

Adapt the parameter names in [`revit_listener.py`](./revit_listener.py)
(`Fire Rating`, `Width`, …) to the client's Revit template. To make it permanent,
drop the listener into a pyRevit startup script so it's always on.

---

## 🔧 Manual config (fallback)

If you'd rather not run the script, add this to
`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "revit": {
      "command": "uvx",
      "args": ["--from", "C:\\path\\to\\revit-mcp", "revit-mcp"],
      "env": { "REVIT_MCP_MODE": "demo" }
    }
  }
}
```

---

## 🔗 Via TwinMCP (the product path)

To deliver this through TwinMCP (one URL, one key, per-user access, audit) rather
than a local Claude Desktop config: publish `revit-mcp`, add a catalog entry with
`hostMode: "local"`, `runtime: "python"`, `startCmd: "uvx revit-mcp"`, then run the
local agent on the client's machine (`ctx7 connect --server <slug>`) so it relays
this local MCP to the TwinMCP proxy. Same local-agent pattern already proven for
other desktop design tools — the Revit data stays on the client's network.

---

_Part of TwinMCP · a Revit-optimised MCP connector._
