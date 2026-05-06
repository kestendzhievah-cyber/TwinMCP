import { describe, it, expect } from "vitest";
import {
  slugify,
  validateConfigAgainstSchema,
  createServerSchema,
  installMcpSchema,
  updateUserServerSchema,
} from "./platform";

describe("slugify", () => {
  it("converts spaces and uppercase", () => {
    expect(slugify("My Cool Server")).toBe("my-cool-server");
  });
  it("strips leading/trailing hyphens", () => {
    expect(slugify("--Foo--")).toBe("foo");
  });
  it("collapses non-alphanumerics", () => {
    expect(slugify("a@@b!!c")).toBe("a-b-c");
  });
  it("truncates to 64 chars", () => {
    expect(slugify("a".repeat(100)).length).toBe(64);
  });
});

describe("validateConfigAgainstSchema", () => {
  const schema = {
    properties: {
      TOKEN: { type: "string" as const, required: true, secret: false },
      LIMIT: { type: "number" as const, required: false, secret: false },
    },
  };

  it("passes when required field present", () => {
    expect(validateConfigAgainstSchema({ TOKEN: "abc" }, schema)).toEqual({ ok: true });
  });
  it("fails when required field missing", () => {
    const r = validateConfigAgainstSchema({}, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/TOKEN/);
  });
  it("fails on wrong type", () => {
    const r = validateConfigAgainstSchema({ TOKEN: "abc", LIMIT: "10" }, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/LIMIT/);
  });
  it("treats empty string as missing for required", () => {
    const r = validateConfigAgainstSchema({ TOKEN: "" }, schema);
    expect(r.ok).toBe(false);
  });
});

describe("createServerSchema", () => {
  it("accepts minimal payload", () => {
    expect(createServerSchema.safeParse({ name: "My Server" }).success).toBe(true);
  });
  it("rejects empty name", () => {
    expect(createServerSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects invalid slug", () => {
    expect(createServerSchema.safeParse({ name: "x", slug: "Bad Slug!" }).success).toBe(false);
  });
});

describe("installMcpSchema", () => {
  it("requires mcpServerId", () => {
    expect(installMcpSchema.safeParse({}).success).toBe(false);
  });
  it("defaults config to empty object", () => {
    const r = installMcpSchema.safeParse({ mcpServerId: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.config).toEqual({});
  });
});

describe("updateUserServerSchema", () => {
  it("requires at least one of enabled/config", () => {
    expect(updateUserServerSchema.safeParse({}).success).toBe(false);
  });
  it("accepts toggle", () => {
    expect(updateUserServerSchema.safeParse({ enabled: false }).success).toBe(true);
  });
});
