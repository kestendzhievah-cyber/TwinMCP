"""Auto-configure Claude Desktop to use this server — no hand-editing JSON.

Writes (merging, never clobbering other servers) an `mcpServers.revit` entry into
the Claude Desktop config for the current OS. Backs up any existing file first.
Set REVIT_MCP_CLAUDE_CONFIG to override the target path (handy for testing).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def pkg_dir() -> str:
    """Absolute path of the package root (the folder containing pyproject.toml)."""
    return str(Path(__file__).resolve().parent.parent)


def claude_config_path() -> Path:
    override = os.environ.get("REVIT_MCP_CLAUDE_CONFIG")
    if override:
        return Path(override)
    if sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return base / "Claude" / "claude_desktop_config.json"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"
    base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "Claude" / "claude_desktop_config.json"


def configure(
    mode: str = "demo",
    host: str = "127.0.0.1",
    port: str = "8765",
    server_name: str = "revit",
) -> Path:
    cfg_path = claude_config_path()
    cfg_path.parent.mkdir(parents=True, exist_ok=True)

    data: dict = {}
    if cfg_path.exists():
        try:
            data = json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001 — don't lose a malformed file, back it up
            data = {}
        # Keep a backup before overwriting.
        cfg_path.with_suffix(".json.bak").write_text(
            cfg_path.read_text(encoding="utf-8"), encoding="utf-8"
        )

    env: dict[str, str] = {"REVIT_MCP_MODE": mode}
    if mode == "live":
        env["REVIT_HOST"] = host
        env["REVIT_PORT"] = str(port)

    servers = data.setdefault("mcpServers", {})
    servers[server_name] = {
        "command": "uvx",
        "args": ["--from", pkg_dir(), "revit-mcp"],
        "env": env,
    }

    cfg_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return cfg_path
