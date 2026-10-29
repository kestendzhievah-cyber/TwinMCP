import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// resolveSecretRefs against a mocked DB: the user_secrets lookup returns
// encrypted rows; the last_used_at update is recorded.

const state: {
  rows: Array<{ id: string; name: string; value: unknown }>;
  selects: number;
  updates: Array<Record<string, unknown>>;
} = { rows: [], selects: 0, updates: [] };

function chain(result: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "innerJoin", "returning"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve().then(result).then(res, rej);
  return q;
}

vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => {
      state.selects++;
      return chain(() => state.rows);
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        state.updates.push(values);
        return chain(() => []);
      },
    }),
  }),
}));

import { encryptConfig } from "@/lib/crypto/config-encryption";
import {
  findMissingSecrets,
  MissingSecretError,
  resolveSecretRefs,
  resolveSecretRefsOrThrow,
} from "@/lib/vault/resolve";

beforeAll(() => {
  process.env.CONFIG_ENCRYPTION_KEY = "11".repeat(32);
});

beforeEach(() => {
  state.rows = [];
  state.selects = 0;
  state.updates = [];
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("resolveSecretRefs", () => {
  it("costs no query when the config has no reference", async () => {
    const config = { KEY: "plain", N: 1 };
    const out = await resolveSecretRefs("u1", config);
    expect(out).toEqual({ config, missing: [] });
    expect(state.selects).toBe(0);
  });

  it("decrypts and substitutes, then touches last_used_at", async () => {
    state.rows = [{ id: "s1", name: "GH", value: encryptConfig("ghp_secret") }];
    const out = await resolveSecretRefs("u1", {
      GITHUB_TOKEN: "{{secret:GH}}",
      HEADER: "Bearer {{secret:GH}}",
    });
    expect(out.missing).toEqual([]);
    expect(out.config).toEqual({ GITHUB_TOKEN: "ghp_secret", HEADER: "Bearer ghp_secret" });
    await flush();
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it("reports unknown, invalid and undecryptable names as missing", async () => {
    state.rows = [
      { id: "s2", name: "BROKEN", value: { ciphertext: "AA==", iv: "AA==", tag: "AA==" } },
    ];
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await resolveSecretRefs("u1", {
      A: "{{secret:NOPE}}",
      B: "{{secret:bad-name}}",
      C: "{{secret:BROKEN}}",
    });
    err.mockRestore();
    expect(out.missing.sort()).toEqual(["BROKEN", "NOPE", "bad-name"]);
    // placeholders stay in place: callers must refuse the config
    expect(out.config.A).toBe("{{secret:NOPE}}");
    await flush();
    expect(state.updates).toHaveLength(0);
  });

  it("does not touch last_used_at for a pre-check", async () => {
    state.rows = [{ id: "s1", name: "GH", value: encryptConfig("v") }];
    expect(await findMissingSecrets("u1", { A: "{{secret:GH}}", B: "{{secret:X}}" })).toEqual([
      "X",
    ]);
    await flush();
    expect(state.updates).toHaveLength(0);
  });

  it("resolveSecretRefsOrThrow throws a MissingSecretError naming the secret", async () => {
    await expect(resolveSecretRefsOrThrow("u1", { A: "{{secret:GITHUB_TOKEN}}" })).rejects.toThrow(
      new MissingSecretError(["GITHUB_TOKEN"])
    );
    await expect(
      resolveSecretRefsOrThrow("u1", { A: "{{secret:GITHUB_TOKEN}}" })
    ).rejects.toMatchObject({ message: "Missing secret GITHUB_TOKEN", names: ["GITHUB_TOKEN"] });
  });
});
