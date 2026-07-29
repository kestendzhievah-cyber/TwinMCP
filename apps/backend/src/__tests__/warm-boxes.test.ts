import { describe, it, expect } from "vitest";
import { can, keepWarm, PLAN_CAPABILITIES } from "@/lib/plan-features";
import type { Plan } from "@/db/schema/core";

const PLANS: Plan[] = ["free", "pro", "team"];

describe("warm boxes gating", () => {
  it("only Pro and Team have the warmServers capability", () => {
    expect(can("free", "warmServers")).toBe(false);
    expect(can("pro", "warmServers")).toBe(true);
    expect(can("team", "warmServers")).toBe(true);
  });

  it("every plan defines warmServers", () => {
    for (const p of PLANS) {
      expect(typeof PLAN_CAPABILITIES[p].warmServers).toBe("boolean");
    }
  });

  it("keepWarm is off for everyone while the ops switch is disabled", () => {
    for (const p of PLANS) {
      expect(keepWarm(p, false)).toBe(false);
    }
  });

  it("with the switch on, only Pro/Team run warm (Free never does)", () => {
    expect(keepWarm("free", true)).toBe(false);
    expect(keepWarm("pro", true)).toBe(true);
    expect(keepWarm("team", true)).toBe(true);
  });

  it("keepWarm === (enabled AND capability) for all combinations", () => {
    for (const p of PLANS) {
      for (const enabled of [true, false]) {
        expect(keepWarm(p, enabled)).toBe(enabled && can(p, "warmServers"));
      }
    }
  });
});
