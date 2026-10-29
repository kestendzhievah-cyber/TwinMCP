import { describe, it, expect } from "vitest";
import { lifecycleLabel } from "@/lib/server-lifecycle-label";
import type { ServerStatus } from "@/db/schema/platform";

const box = (status: ServerStatus, boxId: string | null) => ({
  status,
  hostType: "upstash_box" as const,
  boxId,
});
const agent = (status: ServerStatus) => ({
  status,
  hostType: "local_agent" as const,
  boxId: null,
});

describe("lifecycleLabel", () => {
  it("a stopped box server with a box reads as paused, not 'stopped'", () => {
    const l = lifecycleLabel(box("stopped", "box_1"));
    expect(l.state).toBe("paused");
    expect(l.label).toBe("Paused — resumes on next request");
    expect(l.variant).toBe("info");
    expect(l.transient).toBe(false);
    expect(l.label.toLowerCase()).not.toContain("stopped");
  });

  it("a stopped box server without a box reads as no runtime, with Start", () => {
    const l = lifecycleLabel(box("stopped", null));
    expect(l.state).toBe("no_runtime");
    expect(l.label).toBe("No runtime — Start");
    expect(l.help).toContain("Start");
    expect(l.variant).toBe("secondary");
  });

  it("a stopped local-agent server reads as agent offline", () => {
    const l = lifecycleLabel(agent("stopped"));
    expect(l.state).toBe("agent_offline");
    expect(l.label).toBe("Agent offline");
  });

  it("only provisioning is transient", () => {
    expect(lifecycleLabel(box("provisioning", null)).transient).toBe(true);
    for (const s of ["running", "error", "destroyed", "stopped"] as const) {
      expect(lifecycleLabel(box(s, "box_1")).transient).toBe(false);
    }
  });

  it("maps the settled states to their status tints", () => {
    expect(lifecycleLabel(box("running", "box_1")).variant).toBe("success");
    expect(lifecycleLabel(box("error", null)).variant).toBe("destructive");
    expect(lifecycleLabel(box("destroyed", null)).variant).toBe("outline");
    expect(lifecycleLabel(box("provisioning", null)).variant).toBe("warning");
  });

  it("speaks French for the admin console", () => {
    expect(lifecycleLabel(box("stopped", "box_1"), "fr").label).toBe(
      "En pause — reprend à la prochaine requête"
    );
    expect(lifecycleLabel(box("stopped", null), "fr").label).toBe("Aucun runtime — Démarrer");
    // Same tint whatever the language.
    expect(lifecycleLabel(box("stopped", "box_1"), "fr").variant).toBe("info");
  });

  it("never sends the old 'Sleeping… Start it' copy", () => {
    for (const s of ["provisioning", "running", "stopped", "error", "destroyed"] as const) {
      for (const id of ["box_1", null]) {
        expect(lifecycleLabel(box(s, id)).help).not.toMatch(/sleeping/i);
      }
    }
  });
});
