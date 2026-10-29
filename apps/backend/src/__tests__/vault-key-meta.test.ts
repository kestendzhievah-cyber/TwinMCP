import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { calls: 0, row: null as { externalUserId: string | null } | null, fail: false };

vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => {
      db.calls++;
      const q: Record<string, unknown> = {};
      for (const m of ["from", "where", "limit"]) q[m] = () => q;
      q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        (db.fail
          ? Promise.reject(new Error("db down"))
          : Promise.resolve(db.row ? [db.row] : [])
        ).then(res, rej);
      return q;
    },
  }),
}));

import {
  _clearKeyMetaCache,
  checkExternalUserId,
  EXTERNAL_USER_ID_MAX,
  getKeyExternalUserId,
} from "@/lib/vault/key-meta";

beforeEach(() => {
  _clearKeyMetaCache();
  db.calls = 0;
  db.row = null;
  db.fail = false;
});

describe("checkExternalUserId", () => {
  it("absent or blank → null", () => {
    expect(checkExternalUserId(undefined, "mcp_proxy")).toEqual({ ok: true, value: null });
    expect(checkExternalUserId(null, "full")).toEqual({ ok: true, value: null });
    expect(checkExternalUserId("   ", "full")).toEqual({ ok: true, value: null });
  });

  it("trims and accepts up to 128 characters on a proxy key", () => {
    expect(checkExternalUserId("  acme-42 ", "mcp_proxy")).toEqual({ ok: true, value: "acme-42" });
    const max = "x".repeat(EXTERNAL_USER_ID_MAX);
    expect(checkExternalUserId(max, "mcp_proxy")).toEqual({ ok: true, value: max });
  });

  it("rejects too long, control characters, non-strings and full keys", () => {
    expect(checkExternalUserId("x".repeat(129), "mcp_proxy").ok).toBe(false);
    expect(checkExternalUserId("a\nb", "mcp_proxy").ok).toBe(false);
    expect(checkExternalUserId(42, "mcp_proxy").ok).toBe(false);
    const full = checkExternalUserId("acme", "full");
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.message).toMatch(/mcp_proxy/);
  });
});

describe("getKeyExternalUserId", () => {
  it("null key id → null without a query", async () => {
    expect(await getKeyExternalUserId(null)).toBeNull();
    expect(db.calls).toBe(0);
  });

  it("reads once, then serves from cache", async () => {
    db.row = { externalUserId: "acme" };
    expect(await getKeyExternalUserId("k1")).toBe("acme");
    expect(await getKeyExternalUserId("k1")).toBe("acme");
    expect(db.calls).toBe(1);
  });

  it("never throws: a DB failure reads as null", async () => {
    db.fail = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getKeyExternalUserId("k2")).toBeNull();
    err.mockRestore();
  });
});
