"""Entry point: `python -m revit_mcp` runs the MCP server.

`python -m revit_mcp --selftest` runs the query logic against the demo model and
prints the results — no MCP client (and no `mcp` package) required, so you can
verify the demo data instantly.
"""

import sys


def main() -> None:
    if "--selftest" in sys.argv:
        from . import model

        model.selftest()
        return
    from . import server

    server.main()


if __name__ == "__main__":
    main()
