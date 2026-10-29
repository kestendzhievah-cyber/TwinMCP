import { describe, expect, it } from "vitest";
import { createSecretSchema, danglingRefs, secretJson, updateSecretSchema } from "@/lib/vault/api";
import type { SecretUsage } from "@/lib/vault/usage";

const usage = (id: string): SecretUsage => ({
  userServerId: id,
  serverId: "srv",
  serverName: "Prod",
  serverSlug: "prod",
  mcpSlug: "gh",
  mcpName: "GitHub",
  enabled: true,
  configKeys: ["TOKEN"],
});

describe("secrets API validation", () => {
  it("accepts a valid name and value", () => {
    expect(createSecretSchema.safeParse({ name: "GH_TOKEN", value: "x" }).success).toBe(true);
  });

  it("rejects bad names, empty and oversized values", () => {
    expect(createSecretSchema.safeParse({ name: "gh", value: "x" }).success).toBe(false);
    expect(createSecretSchema.safeParse({ name: "GH", value: "" }).success).toBe(false);
    expect(updateSecretSchema.safeParse({ value: "x".repeat(16_385) }).success).toBe(false);
    expect(updateSecretSchema.safeParse({ value: "x".repeat(16_384) }).success).toBe(true);
  });
});

describe("secretJson", () => {
  it("serializes dates and never carries a value", () => {
    const d = new Date("2026-10-28T10:00:00Z");
    const json = secretJson({ id: "1", name: "A", createdAt: d, updatedAt: d, lastUsedAt: null });
    expect(json).toEqual({
      id: "1",
      name: "A",
      createdAt: "2026-10-28T10:00:00.000Z",
      updatedAt: "2026-10-28T10:00:00.000Z",
      lastUsedAt: null,
      usedBy: [],
    });
    expect(Object.keys(json)).not.toContain("value");
  });
});

describe("danglingRefs", () => {
  it("lists referenced names that are not stored, sorted", () => {
    const map = new Map([
      ["Z_MISSING", [usage("a")]],
      ["STORED", [usage("b")]],
      ["A_MISSING", [usage("c")]],
    ]);
    expect(danglingRefs(map, new Set(["STORED"])).map((d) => d.name)).toEqual([
      "A_MISSING",
      "Z_MISSING",
    ]);
  });
});
