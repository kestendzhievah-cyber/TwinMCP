"""Command dispatcher for the `revit-mcp` executable.

  revit-mcp                 → run the MCP server over stdio (Claude spawns this)
  revit-mcp configure       → auto-write the Claude Desktop config (--mode demo|live)
  revit-mcp --selftest      → print the demo model queries (no MCP needed)
"""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    argv = sys.argv[1:]

    if argv and argv[0] == "configure":
        from . import configure as cfg

        p = argparse.ArgumentParser(prog="revit-mcp configure")
        p.add_argument("--mode", choices=["demo", "live"], default="demo")
        p.add_argument("--host", default="127.0.0.1")
        p.add_argument("--port", default="8765")
        p.add_argument("--name", default="revit")
        a = p.parse_args(argv[1:])

        path = cfg.configure(mode=a.mode, host=a.host, port=a.port, server_name=a.name)
        print(f"[OK] Claude Desktop configured — server '{a.name}', mode '{a.mode}'.")
        print(f"     Config file: {path}")
        print("")
        print(">> Next: fully restart Claude Desktop, then ask it about the Revit model.")
        if a.mode == "live":
            print(">> In Revit (pyRevit console), start the listener with:")
            print(f"     exec(open(r'{cfg.pkg_dir()}\\revit_listener.py').read())")
        return

    if "--selftest" in argv:
        from . import model

        model.selftest()
        return

    from . import server

    server.main()


if __name__ == "__main__":
    main()
