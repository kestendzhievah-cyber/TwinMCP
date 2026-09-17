"""MCP server exposing Revit BIM queries as tools.

Tools are thin wrappers over revit_mcp.model, which works against baked-in demo
data (REVIT_MCP_MODE=demo, the default) or a live Revit model (mode=live).
The docstrings are what the model (Claude) reads to decide which tool to call —
keep them clear and task-oriented.
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from . import model

mcp = FastMCP("revit-mcp")


@mcp.tool()
def project_summary() -> dict[str, Any]:
    """High-level overview of the current Revit project: name, number of levels,
    element counts per category (Walls, Doors, Windows, Rooms), and total room
    area. Call this first to orient yourself before answering questions."""
    return model.project_summary()


@mcp.tool()
def list_levels() -> list[dict[str, Any]]:
    """List the building levels (floors) with their id, name and elevation."""
    return model.list_levels()


@mcp.tool()
def query_elements(category: str | None = None, level: str | None = None) -> list[dict[str, Any]]:
    """List model elements, optionally filtered by category and/or level.

    category: one of "Walls", "Doors", "Windows", "Rooms" (case-insensitive).
    level: a level id like "L3" or a level name like "Ниво 3".
    Returns each element with its parameters (type, width_mm, fire_rating,
    area_m2, …) and a human-readable level_name."""
    return model.query_elements(category=category, level=level)


@mcp.tool()
def get_quantities(category: str, group_by: str = "level") -> dict[str, Any]:
    """Bill-of-quantities / take-off for a category, grouped by "level" (default)
    or "type". Returns counts plus total length (walls) or total area (rooms).
    Use this for quantity questions like "how many doors per level"."""
    return model.get_quantities(category=category, group_by=group_by)


@mcp.tool()
def check_fire_ratings() -> dict[str, Any]:
    """QA/compliance check: find all Walls and Doors that have no fire rating
    assigned. Use this to answer "which walls/doors are missing a fire rating"."""
    return model.check_fire_ratings()


@mcp.tool()
def check_accessibility(min_door_width_mm: int = model.ACCESSIBILITY_MIN_DOOR_MM) -> dict[str, Any]:
    """Accessibility check: find doors narrower than the minimum clear width
    (default 900 mm). Use this to answer "which doors/rooms don't meet
    accessibility requirements"."""
    return model.check_accessibility(min_door_width_mm=min_door_width_mm)


@mcp.tool()
def get_element(element_id: str) -> dict[str, Any]:
    """Full details of a single element by its id (e.g. "D-301")."""
    return model.get_element(element_id)


def main() -> None:
    """Run the MCP server over stdio."""
    mcp.run()


if __name__ == "__main__":
    main()
