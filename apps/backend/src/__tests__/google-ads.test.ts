import { describe, expect, it } from "vitest";
import { normalizeEmailForAds, sha256Hex } from "../lib/analytics/google-ads";

// Enhanced conversions send Google a SHA-256 of the normalized email. Google
// matches it against its own hash, so normalization must follow its rules.
describe("normalizeEmailForAds", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmailForAds("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
  });

  it("drops dots in the local part of gmail.com and googlemail.com addresses", () => {
    expect(normalizeEmailForAds("Jane.Doe@gmail.com")).toBe("janedoe@gmail.com");
    expect(normalizeEmailForAds("j.d@googlemail.com")).toBe("jd@googlemail.com");
  });

  it("keeps dots for other domains and leaves malformed input untouched", () => {
    expect(normalizeEmailForAds("first.last@twinmcp.fr")).toBe("first.last@twinmcp.fr");
    expect(normalizeEmailForAds("not-an-email")).toBe("not-an-email");
  });
});

describe("sha256Hex", () => {
  it("returns the lower-case hex SHA-256", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
