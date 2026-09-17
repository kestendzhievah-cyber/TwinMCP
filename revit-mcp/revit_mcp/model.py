"""Revit model access for the MCP server.

Two modes, selected by the REVIT_MCP_MODE env var:
  - "demo" (default): a realistic sample office-building model is baked in, so
    the whole thing works with no Revit install — perfect for a live sales demo.
  - "live": fetches the real model from a listener running inside Revit (see
    ../revit_listener.py) over a local TCP socket (REVIT_HOST / REVIT_PORT).

All query functions operate on the same shape: a model dict with
{ "project", "levels", "elements" }. The live listener must return that shape,
so the tools below work identically against demo data and a real Revit model.
"""

from __future__ import annotations

import json
import os
import socket
from typing import Any

MODE = os.environ.get("REVIT_MCP_MODE", "demo").lower()

# Door leaf width (mm) below which a door is flagged as an accessibility risk.
ACCESSIBILITY_MIN_DOOR_MM = int(os.environ.get("REVIT_ACCESSIBILITY_MIN_DOOR_MM", "900"))


# ── Demo model: a small office building (fictional, in Bulgarian) ─────────────
DEMO_MODEL: dict[str, Any] = {
    "project": {"name": "Примерна офис сграда — гр. София", "units": "mm", "source": "demo"},
    "levels": [
        {"id": "L1", "name": "Ниво 1 — Партер", "elevation_mm": 0},
        {"id": "L2", "name": "Ниво 2", "elevation_mm": 3500},
        {"id": "L3", "name": "Ниво 3", "elevation_mm": 7000},
    ],
    "elements": [
        # Walls (some deliberately missing a fire rating)
        {"id": "W-101", "category": "Walls", "level": "L1", "type": "Външна стена 300мм", "length_mm": 12500, "fire_rating": "EI 90"},
        {"id": "W-102", "category": "Walls", "level": "L1", "type": "Вътрешна стена 120мм", "length_mm": 8200, "fire_rating": None},
        {"id": "W-103", "category": "Walls", "level": "L1", "type": "Преградна стена 100мм", "length_mm": 5400, "fire_rating": None},
        {"id": "W-201", "category": "Walls", "level": "L2", "type": "Външна стена 300мм", "length_mm": 12500, "fire_rating": "EI 90"},
        {"id": "W-202", "category": "Walls", "level": "L2", "type": "Вътрешна стена 120мм", "length_mm": 7600, "fire_rating": "EI 60"},
        {"id": "W-301", "category": "Walls", "level": "L3", "type": "Външна стена 300мм", "length_mm": 12500, "fire_rating": "EI 90"},
        {"id": "W-302", "category": "Walls", "level": "L3", "type": "Вътрешна стена 120мм", "length_mm": 6100, "fire_rating": None},
        # Doors (mix of fire-rated / not, and widths — some below 900mm)
        {"id": "D-101", "category": "Doors", "level": "L1", "type": "Входна врата", "width_mm": 1200, "fire_rating": None},
        {"id": "D-102", "category": "Doors", "level": "L1", "type": "Единична врата", "width_mm": 900, "fire_rating": None},
        {"id": "D-103", "category": "Doors", "level": "L1", "type": "Пожарна врата", "width_mm": 1000, "fire_rating": "EI 60"},
        {"id": "D-201", "category": "Doors", "level": "L2", "type": "Единична врата", "width_mm": 800, "fire_rating": None},
        {"id": "D-202", "category": "Doors", "level": "L2", "type": "Пожарна врата", "width_mm": 1000, "fire_rating": "EI 30"},
        {"id": "D-301", "category": "Doors", "level": "L3", "type": "Пожарна врата", "width_mm": 1000, "fire_rating": "EI 60"},
        {"id": "D-302", "category": "Doors", "level": "L3", "type": "Пожарна врата", "width_mm": 1000, "fire_rating": "EI 60"},
        {"id": "D-303", "category": "Doors", "level": "L3", "type": "Единична врата", "width_mm": 850, "fire_rating": None},
        # Windows
        {"id": "WN-101", "category": "Windows", "level": "L1", "type": "Прозорец 1200x1500", "width_mm": 1200, "height_mm": 1500},
        {"id": "WN-102", "category": "Windows", "level": "L1", "type": "Прозорец 1200x1500", "width_mm": 1200, "height_mm": 1500},
        {"id": "WN-201", "category": "Windows", "level": "L2", "type": "Прозорец 1500x1800", "width_mm": 1500, "height_mm": 1800},
        {"id": "WN-301", "category": "Windows", "level": "L3", "type": "Прозорец 1500x1800", "width_mm": 1500, "height_mm": 1800},
        # Rooms
        {"id": "R-101", "category": "Rooms", "level": "L1", "name": "Рецепция", "area_m2": 32.0},
        {"id": "R-102", "category": "Rooms", "level": "L1", "name": "Офис 1", "area_m2": 24.5},
        {"id": "R-201", "category": "Rooms", "level": "L2", "name": "Офис 2", "area_m2": 28.0},
        {"id": "R-202", "category": "Rooms", "level": "L2", "name": "Заседателна зала", "area_m2": 40.0},
        {"id": "R-301", "category": "Rooms", "level": "L3", "name": "Офис 3", "area_m2": 26.5},
        {"id": "R-302", "category": "Rooms", "level": "L3", "name": "Архив", "area_m2": 15.0},
    ],
}


# ── Model loading ────────────────────────────────────────────────────────────
def load_model() -> dict[str, Any]:
    """Return the current model as { project, levels, elements }."""
    if MODE == "live":
        return _fetch_live_model()
    return DEMO_MODEL


def _fetch_live_model() -> dict[str, Any]:
    host = os.environ.get("REVIT_HOST", "127.0.0.1")
    port = int(os.environ.get("REVIT_PORT", "8765"))
    try:
        with socket.create_connection((host, port), timeout=5) as s:
            s.sendall(b'{"action":"get_project"}\n')
            s.settimeout(15)
            buf = b""
            while b"\n" not in buf:
                chunk = s.recv(65536)
                if not chunk:
                    break
                buf += chunk
        line = buf.decode("utf-8").splitlines()[0]
        return json.loads(line)
    except Exception as e:  # noqa: BLE001 — surface a clear, actionable message
        raise RuntimeError(
            f"Не може да се свърже с Revit на {host}:{port}. "
            f"Стартиран ли е слушателят (add-in) в Revit? Детайл: {e}"
        ) from e


# ── Helpers ──────────────────────────────────────────────────────────────────
def _levels_by_id(model: dict[str, Any]) -> dict[str, str]:
    return {lv["id"]: lv["name"] for lv in model.get("levels", [])}


def _level_name(model: dict[str, Any], level_id: str | None) -> str:
    if not level_id:
        return "—"
    return _levels_by_id(model).get(level_id, level_id)


def _with_level_name(model: dict[str, Any], el: dict[str, Any]) -> dict[str, Any]:
    out = dict(el)
    out["level_name"] = _level_name(model, el.get("level"))
    return out


# ── Query API (used by the MCP tools) ────────────────────────────────────────
def project_summary() -> dict[str, Any]:
    m = load_model()
    by_cat: dict[str, int] = {}
    total_area = 0.0
    for el in m["elements"]:
        by_cat[el["category"]] = by_cat.get(el["category"], 0) + 1
        if el["category"] == "Rooms":
            total_area += float(el.get("area_m2", 0) or 0)
    return {
        "project": m["project"]["name"],
        "mode": MODE,
        "levels": len(m.get("levels", [])),
        "elements_by_category": by_cat,
        "total_room_area_m2": round(total_area, 1),
    }


def list_levels() -> list[dict[str, Any]]:
    return list(load_model().get("levels", []))


def query_elements(category: str | None = None, level: str | None = None) -> list[dict[str, Any]]:
    m = load_model()
    cat = category.lower() if category else None
    out = []
    for el in m["elements"]:
        if cat and el["category"].lower() != cat:
            continue
        if level and el.get("level") not in (level, _level_name(m, el.get("level"))):
            # allow matching by level id ("L3") or by name ("Ниво 3")
            if _level_name(m, el.get("level")) != level:
                continue
        out.append(_with_level_name(m, el))
    return out


def get_quantities(category: str, group_by: str = "level") -> dict[str, Any]:
    m = load_model()
    cat = category.lower()
    rows = [el for el in m["elements"] if el["category"].lower() == cat]
    groups: dict[str, dict[str, Any]] = {}
    for el in rows:
        key = _level_name(m, el.get("level")) if group_by == "level" else el.get("type", "—")
        g = groups.setdefault(key, {"count": 0, "total_length_mm": 0, "total_area_m2": 0.0})
        g["count"] += 1
        if el.get("length_mm"):
            g["total_length_mm"] += int(el["length_mm"])
        if el.get("area_m2"):
            g["total_area_m2"] = round(g["total_area_m2"] + float(el["area_m2"]), 1)
    # Drop zero aggregate columns for readability
    for g in groups.values():
        if g["total_length_mm"] == 0:
            del g["total_length_mm"]
        if g["total_area_m2"] == 0:
            del g["total_area_m2"]
    return {"category": category, "group_by": group_by, "total": len(rows), "groups": groups}


def check_fire_ratings() -> dict[str, Any]:
    """Walls and doors that have no fire rating — a common QA/compliance gap."""
    m = load_model()
    missing = [
        _with_level_name(m, el)
        for el in m["elements"]
        if el["category"] in ("Walls", "Doors") and not el.get("fire_rating")
    ]
    return {
        "checked": "Walls + Doors",
        "missing_count": len(missing),
        "missing": [
            {"id": el["id"], "category": el["category"], "type": el.get("type"), "level": el["level_name"]}
            for el in missing
        ],
    }


def check_accessibility(min_door_width_mm: int = ACCESSIBILITY_MIN_DOOR_MM) -> dict[str, Any]:
    """Doors narrower than the accessibility threshold (default 900 mm)."""
    m = load_model()
    bad = [
        _with_level_name(m, el)
        for el in m["elements"]
        if el["category"] == "Doors" and int(el.get("width_mm", 0)) < min_door_width_mm
    ]
    return {
        "min_door_width_mm": min_door_width_mm,
        "non_compliant_count": len(bad),
        "non_compliant": [
            {"id": el["id"], "type": el.get("type"), "width_mm": el.get("width_mm"), "level": el["level_name"]}
            for el in bad
        ],
    }


def get_element(element_id: str) -> dict[str, Any]:
    m = load_model()
    for el in m["elements"]:
        if el["id"].lower() == element_id.lower():
            return _with_level_name(m, el)
    return {"error": f"Елемент с идентификатор '{element_id}' не е намерен."}


# ── Self-test (no MCP transport needed) ──────────────────────────────────────
def selftest() -> None:
    def show(label: str, value: Any) -> None:
        print(f"\n=== {label} ===")
        print(json.dumps(value, ensure_ascii=False, indent=2))

    print(f"REVIT_MCP_MODE = {MODE}")
    show("project_summary", project_summary())
    show("list_levels", list_levels())
    show("query_elements(Doors, L3)", query_elements("Doors", "L3"))
    show("get_quantities(Doors)", get_quantities("Doors"))
    show("get_quantities(Windows)", get_quantities("Windows"))
    show("check_fire_ratings", check_fire_ratings())
    show("check_accessibility", check_accessibility())
