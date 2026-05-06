import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptConfig, decryptConfig } from "./config-encryption";

beforeAll(() => {
  process.env.CONFIG_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("config-encryption", () => {
  it("round-trips a plain object", () => {
    const input = { apiKey: "secret-token", maxRetries: 3 };
    const enc = encryptConfig(input);
    const dec = decryptConfig<typeof input>(enc);
    expect(dec).toEqual(input);
  });

  it("produces a different IV each call", () => {
    const a = encryptConfig({ x: 1 });
    const b = encryptConfig({ x: 1 });
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptConfig({ secret: "value" });
    const buf = Buffer.from(enc.ciphertext, "base64");
    buf[0] = (buf[0] ?? 0) ^ 0x01;
    const tampered = { ...enc, ciphertext: buf.toString("base64") };
    expect(() => decryptConfig(tampered)).toThrow();
  });

  it("throws when key is missing", () => {
    const original = process.env.CONFIG_ENCRYPTION_KEY;
    delete process.env.CONFIG_ENCRYPTION_KEY;
    expect(() => encryptConfig({ x: 1 })).toThrow(/CONFIG_ENCRYPTION_KEY/);
    process.env.CONFIG_ENCRYPTION_KEY = original;
  });

  it("throws when key is wrong length", () => {
    const original = process.env.CONFIG_ENCRYPTION_KEY;
    process.env.CONFIG_ENCRYPTION_KEY = "abcd";
    expect(() => encryptConfig({ x: 1 })).toThrow(/32 bytes/);
    process.env.CONFIG_ENCRYPTION_KEY = original;
  });
});
