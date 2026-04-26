import { describe, it, expect } from "vitest";
import { hashKey, generateApiKey, API_KEY_PREFIX } from "@/lib/auth";

describe("API Key generation", () => {
  it("generates a key with correct prefix", () => {
    const { raw, prefix, hash } = generateApiKey();
    expect(raw.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix.length).toBe(12);
    expect(hash).toBeTruthy();
  });

  it("hashes are deterministic", () => {
    const h1 = hashKey("test-key");
    const h2 = hashKey("test-key");
    expect(h1).toBe(h2);
  });

  it("different keys produce different hashes", () => {
    const h1 = hashKey("key-a");
    const h2 = hashKey("key-b");
    expect(h1).not.toBe(h2);
  });

  it("generated keys are unique", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});
