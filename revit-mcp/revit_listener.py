"""Revit-side listener — REFERENCE for the LIVE integration.

This runs INSIDE Revit (via pyRevit or a Revit add-in with an embedded Python
engine) and exposes the real model to the MCP server over a local TCP socket.
The MCP server (revit_mcp.model, mode="live") connects and sends one request:

    {"action": "get_project"}\n

and expects back one line of JSON with the SAME shape the demo model uses:

    {
      "project": {"name": "...", "units": "mm", "source": "revit"},
      "levels":  [{"id": "L1", "name": "...", "elevation_mm": 0}, ...],
      "elements":[{"id": "...", "category": "Walls|Doors|Windows|Rooms",
                   "level": "L1", "type": "...", "fire_rating": "EI 60",
                   "width_mm": 900, "length_mm": 12500, "area_m2": 24.5}, ...]
    }

Because the MCP server does all filtering/aggregation client-side, the listener
only has to return the whole model once per call — keeping the Revit add-in
minimal. Adapt the `read_model()` body below to your project's parameter names.

Run it from the pyRevit console (Revit must be open with a document loaded):
    exec(open(r"C:\\path\\to\\revit_listener.py").read())

⚠️ This file is a starting point. The `Autodesk.Revit.DB` calls only work inside
Revit's Python engine; it will not run in a plain CPython outside Revit.
"""

import json
import socket
import threading

HOST = "127.0.0.1"
PORT = 8765

# `doc` is provided by the pyRevit / RevitPythonShell environment. When running
# as a proper add-in, pass your ExternalCommandData's Document instead.
try:  # pragma: no cover - only meaningful inside Revit
    doc = __revit__.ActiveUIDocument.Document  # type: ignore  # noqa: F821
except Exception:  # noqa: BLE001
    doc = None


def _mm(feet):
    """Revit stores lengths in decimal feet — convert to millimetres."""
    return round(float(feet) * 304.8)


def read_model():
    """Walk the active Revit document and build the model dict.

    Uses FilteredElementCollector + BuiltInCategory. Parameter lookups
    (fire rating, width, area) use common built-ins; rename to match your
    template's shared parameters as needed.
    """
    from Autodesk.Revit.DB import (  # type: ignore  # noqa: F401
        BuiltInCategory,
        BuiltInParameter,
        FilteredElementCollector,
        Level,
    )

    def param(el, *names):
        for n in names:
            p = el.LookupParameter(n)
            if p and p.HasValue:
                return p.AsString() or p.AsValueString()
        return None

    levels = []
    level_name_by_id = {}
    for lv in FilteredElementCollector(doc).OfClass(Level):
        lid = "L%d" % (len(levels) + 1)
        levels.append({"id": lid, "name": lv.Name, "elevation_mm": _mm(lv.Elevation)})
        level_name_by_id[lv.Id.IntegerValue] = lid

    def lvl_of(el):
        try:
            return level_name_by_id.get(el.LevelId.IntegerValue)
        except Exception:  # noqa: BLE001
            return None

    elements = []

    for w in FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Walls).WhereElementIsNotElementType():
        elements.append({
            "id": "W-%d" % w.Id.IntegerValue,
            "category": "Walls",
            "level": lvl_of(w),
            "type": doc.GetElement(w.GetTypeId()).Name,
            "length_mm": _mm(w.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH).AsDouble())
            if w.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH) else None,
            "fire_rating": param(w, "Fire Rating", "Пожароустойчивост"),
        })

    for d in FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Doors).WhereElementIsNotElementType():
        t = doc.GetElement(d.GetTypeId())
        width = t.get_Parameter(BuiltInParameter.DOOR_WIDTH) or t.LookupParameter("Width")
        elements.append({
            "id": "D-%d" % d.Id.IntegerValue,
            "category": "Doors",
            "level": lvl_of(d),
            "type": t.Name,
            "width_mm": _mm(width.AsDouble()) if width and width.HasValue else None,
            "fire_rating": param(d, "Fire Rating", "Пожароустойчивост") or param(t, "Fire Rating"),
        })

    for wn in FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Windows).WhereElementIsNotElementType():
        elements.append({
            "id": "WN-%d" % wn.Id.IntegerValue,
            "category": "Windows",
            "level": lvl_of(wn),
            "type": doc.GetElement(wn.GetTypeId()).Name,
        })

    for r in FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Rooms).WhereElementIsNotElementType():
        area = r.get_Parameter(BuiltInParameter.ROOM_AREA)
        elements.append({
            "id": "R-%d" % r.Id.IntegerValue,
            "category": "Rooms",
            "level": lvl_of(r),
            "name": r.get_Parameter(BuiltInParameter.ROOM_NAME).AsString() if r.get_Parameter(BuiltInParameter.ROOM_NAME) else None,
            "area_m2": round(float(area.AsDouble()) * 0.092903, 1) if area else None,  # ft² → m²
        })

    return {
        "project": {"name": doc.Title, "units": "mm", "source": "revit"},
        "levels": levels,
        "elements": elements,
    }


def handle(conn):
    try:
        data = b""
        while b"\n" not in data:
            chunk = conn.recv(4096)
            if not chunk:
                break
            data += chunk
        req = json.loads(data.decode("utf-8").splitlines()[0]) if data else {}
        if req.get("action") == "get_project":
            payload = read_model()
        else:
            payload = {"error": "unknown action"}
        conn.sendall((json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8"))
    except Exception as e:  # noqa: BLE001
        conn.sendall((json.dumps({"error": str(e)}) + "\n").encode("utf-8"))
    finally:
        conn.close()


def serve():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, PORT))
    srv.listen(5)
    print("revit-mcp listener on %s:%d — waiting for the MCP server…" % (HOST, PORT))
    while True:
        conn, _ = srv.accept()
        threading.Thread(target=handle, args=(conn,), daemon=True).start()


if __name__ == "__main__":
    serve()
