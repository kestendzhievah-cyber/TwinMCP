import { describe, it, expect } from "vitest";
import { maxMcpsForBoxSize } from "../lib/plan-features";

// Capacity guard: how many box-hosted MCPs each size may run at once (default,
// no env override). Guards against a user OOMing their own box.
describe("maxMcpsForBoxSize", () => {
  it("scales with box size (defaults)", () => {
    expect(maxMcpsForBoxSize("small")).toBe(4);
    expect(maxMcpsForBoxSize("medium")).toBe(8);
    expect(maxMcpsForBoxSize("large")).toBe(16);
  });
});
