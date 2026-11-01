import { describe, expect, it } from "vitest";
import { parseProviderSettings } from "@/lib/auth/oauth-providers";

describe("parseProviderSettings", () => {
  it("reports Google when GoTrue lists it as enabled", () => {
    expect(parseProviderSettings({ external: { google: true, github: false } })).toEqual({
      google: true,
    });
  });

  it("is off when Google is disabled, missing or not a boolean true", () => {
    expect(parseProviderSettings({ external: { google: false } }).google).toBe(false);
    expect(parseProviderSettings({ external: {} }).google).toBe(false);
    expect(parseProviderSettings({ external: { google: "true" } }).google).toBe(false);
  });

  it("is off for an unexpected payload", () => {
    for (const p of [null, undefined, "x", 42, {}, { external: null }]) {
      expect(parseProviderSettings(p).google).toBe(false);
    }
  });
});
