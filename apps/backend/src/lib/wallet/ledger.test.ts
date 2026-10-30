import { describe, expect, it, vi } from "vitest";

// The money rules are exercised through the pure functions and through
// debitWith/creditWith over an in-memory store that mimics a row lock and
// transaction rollback. The only DB read reached here is getWallet (through
// hasCredit), served by this stub: select().from().where().limit().
const fakeDb = vi.hoisted(() => ({
  rows: [] as unknown[],
  reads: 0,
  fail: true,
}));
vi.mock("@/db", () => ({
  getDb: () => {
    if (fakeDb.fail) throw new Error("no database in unit tests");
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: async () => {
        fakeDb.reads += 1;
        return fakeDb.rows;
      },
    };
    return { select: () => chain };
  },
}));

import {
  applyCredit,
  applyDebit,
  applyExpiry,
  creditWith,
  capAtFloor,
  debitWith,
  decodeLedgerCursor,
  effectivePromoMicros,
  emptyWalletState,
  encodeLedgerCursor,
  hasCredit,
  invalidateCreditCache,
  isUniqueViolation,
  ledgerRowsFor,
  totalMicrosOf,
  walletViewFromRow,
  type NewLedgerRow,
  type WalletRunner,
  type WalletState,
  type WalletStore,
} from "./ledger";
import type { WalletAccountRow } from "@/db/schema/wallet";

const EUR = 1_000_000;
const NOW = new Date("2026-10-29T12:00:00Z");
const DAY = 86_400_000;
const later = (ms: number) => new Date(NOW.getTime() + ms);

function wallet(over: Partial<WalletState> = {}): WalletState {
  return { ...emptyWalletState(), ...over };
}

// ---------------------------------------------------------------------------
// Pure arithmetic
// ---------------------------------------------------------------------------

describe("effective balance", () => {
  it("counts promo until it expires", () => {
    const s = wallet({ paidMicros: 3 * EUR, promoMicros: 10 * EUR, promoExpiresAt: later(DAY) });
    expect(effectivePromoMicros(s, NOW)).toBe(10 * EUR);
    expect(totalMicrosOf(s, NOW)).toBe(13 * EUR);
    expect(totalMicrosOf(s, later(DAY))).toBe(3 * EUR); // dead AT expires_at
    expect(totalMicrosOf(s, later(DAY - 1))).toBe(13 * EUR);
  });

  it("treats a promo with no expiry as never expiring", () => {
    const s = wallet({ promoMicros: 2 * EUR, promoExpiresAt: null });
    expect(totalMicrosOf(s, later(10_000 * DAY))).toBe(2 * EUR);
  });
});

describe("applyDebit", () => {
  it("spends promo first", () => {
    const s = wallet({ paidMicros: 20 * EUR, promoMicros: 10 * EUR, promoExpiresAt: later(DAY) });
    const out = applyDebit(s, 4 * EUR, "usage_tool_call", NOW);
    expect(out.state.promoMicros).toBe(6 * EUR);
    expect(out.state.paidMicros).toBe(20 * EUR);
    expect(out.lines).toEqual([
      {
        bucket: "promo",
        kind: "usage_tool_call",
        deltaMicros: -4 * EUR,
        balanceAfterMicros: 26 * EUR,
      },
    ]);
    expect(out.totalBeforeMicros).toBe(30 * EUR);
    expect(out.totalAfterMicros).toBe(26 * EUR);
  });

  it("splits across promo then paid", () => {
    const s = wallet({ paidMicros: 20 * EUR, promoMicros: 1 * EUR, promoExpiresAt: later(DAY) });
    const out = applyDebit(s, 3 * EUR, "usage_compute", NOW);
    expect(out.state).toMatchObject({ promoMicros: 0, paidMicros: 18 * EUR });
    expect(out.lines.map((l) => [l.bucket, l.deltaMicros, l.balanceAfterMicros])).toEqual([
      ["promo", -1 * EUR, 20 * EUR],
      ["paid", -2 * EUR, 18 * EUR],
    ]);
  });

  it("lets paid go negative (usage already happened), never promo", () => {
    const s = wallet({ paidMicros: 1 * EUR, promoMicros: 500_000, promoExpiresAt: later(DAY) });
    const out = applyDebit(s, 3 * EUR, "usage_compute", NOW);
    expect(out.state.promoMicros).toBe(0);
    expect(out.state.paidMicros).toBe(-1_500_000);
    expect(out.totalAfterMicros).toBe(-1_500_000);
    expect(out.crossedZero).toBe(true);
    expect(out.state.zeroBalanceAt).toEqual(NOW);
  });

  it("writes off an expired promo before charging and does not spend it", () => {
    const s = wallet({ paidMicros: 5 * EUR, promoMicros: 7 * EUR, promoExpiresAt: later(-1) });
    const out = applyDebit(s, 1 * EUR, "usage_tool_call", NOW);
    expect(out.lines).toEqual([
      { bucket: "promo", kind: "promo_expiry", deltaMicros: -7 * EUR, balanceAfterMicros: 5 * EUR },
      {
        bucket: "paid",
        kind: "usage_tool_call",
        deltaMicros: -1 * EUR,
        balanceAfterMicros: 4 * EUR,
      },
    ]);
    expect(out.state).toMatchObject({ promoMicros: 0, paidMicros: 4 * EUR });
    expect(out.totalBeforeMicros).toBe(5 * EUR);
  });

  it("flags threshold and zero crossings exactly once", () => {
    const s = wallet({ paidMicros: 6 * EUR, thresholdMicros: 5 * EUR });
    const a = applyDebit(s, 1 * EUR, "usage_tool_call", NOW); // 6 -> 5: crosses (<= threshold)
    expect([a.crossedThreshold, a.crossedZero]).toEqual([true, false]);
    const b = applyDebit(a.state, 1 * EUR, "usage_tool_call", NOW); // 5 -> 4: already below
    expect([b.crossedThreshold, b.crossedZero]).toEqual([false, false]);
    const c = applyDebit(b.state, 4 * EUR, "usage_tool_call", NOW); // 4 -> 0
    expect([c.crossedThreshold, c.crossedZero]).toEqual([false, true]);
    const d = applyDebit(c.state, 1, "usage_tool_call", NOW); // 0 -> -1: already empty
    expect(d.crossedZero).toBe(false);
    expect(d.state.zeroBalanceAt).toEqual(NOW);
  });

  it("flags both crossings when one debit jumps from above threshold to empty", () => {
    const out = applyDebit(wallet({ paidMicros: 6 * EUR }), 7 * EUR, "usage_compute", NOW);
    expect([out.crossedThreshold, out.crossedZero]).toEqual([true, true]);
  });

  it("bucket 'paid' charges paid only (clawback)", () => {
    const s = wallet({ paidMicros: 10 * EUR, promoMicros: 10 * EUR, promoExpiresAt: later(DAY) });
    const out = applyDebit(s, 25 * EUR, "clawback", NOW, "paid");
    expect(out.state).toMatchObject({ promoMicros: 10 * EUR, paidMicros: -15 * EUR });
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]).toMatchObject({ bucket: "paid", deltaMicros: -25 * EUR });
    expect(out.totalAfterMicros).toBe(-5 * EUR);
  });

  it("bucket 'promo' takes at most what promo holds", () => {
    const s = wallet({ paidMicros: 10 * EUR, promoMicros: 2 * EUR, promoExpiresAt: later(DAY) });
    const out = applyDebit(s, 5 * EUR, "adjustment", NOW, "promo");
    expect(out.state).toMatchObject({ promoMicros: 0, paidMicros: 10 * EUR });
    expect(out.lines).toEqual([
      { bucket: "promo", kind: "adjustment", deltaMicros: -2 * EUR, balanceAfterMicros: 10 * EUR },
    ]);
    const empty = applyDebit(out.state, 1, "adjustment", NOW, "promo");
    expect(empty.lines[0].deltaMicros).toBe(0);
    expect(Object.is(empty.lines[0].deltaMicros, -0)).toBe(false);
  });

  it("rejects non-integer, zero or negative amounts", () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect(() => applyDebit(wallet(), bad, "usage_tool_call", NOW)).toThrow(RangeError);
    }
  });

  it("conserves money: sum of line deltas = change in stored buckets", () => {
    const cases: [WalletState, number][] = [
      [wallet({ paidMicros: 3, promoMicros: 4, promoExpiresAt: later(1) }), 5],
      [wallet({ paidMicros: -3, promoMicros: 4, promoExpiresAt: later(-1) }), 5],
      [wallet({ paidMicros: 100, promoMicros: 0 }), 1],
      [wallet({ paidMicros: 0, promoMicros: 9, promoExpiresAt: null }), 9],
    ];
    for (const [s, amount] of cases) {
      const out = applyDebit(s, amount, "usage_compute", NOW);
      const sum = out.lines.reduce((a, l) => a + l.deltaMicros, 0);
      expect(out.state.paidMicros + out.state.promoMicros - (s.paidMicros + s.promoMicros)).toBe(
        sum
      );
      expect(out.lines[out.lines.length - 1].balanceAfterMicros).toBe(out.totalAfterMicros);
      expect(out.state.promoMicros).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("applyCredit", () => {
  it("adds paid credit and marks the wallet funded on a top-up", () => {
    const out = applyCredit(wallet(), 25 * EUR, "paid", "topup", NOW);
    expect(out.state.paidMicros).toBe(25 * EUR);
    expect(out.state.fundedAt).toEqual(NOW);
    expect(out.totalAfterMicros).toBe(25 * EUR);
    expect(out.lines).toEqual([
      { bucket: "paid", kind: "topup", deltaMicros: 25 * EUR, balanceAfterMicros: 25 * EUR },
    ]);
    const again = applyCredit(out.state, 10 * EUR, "paid", "auto_recharge", later(DAY));
    expect(again.state.fundedAt).toEqual(NOW); // first funding kept
  });

  it("does not mark funded for grants or promo", () => {
    expect(applyCredit(wallet(), EUR, "paid", "admin_grant", NOW).state.fundedAt).toBeNull();
    expect(
      applyCredit(wallet(), EUR, "promo", "signup_credit", NOW, later(DAY)).state.fundedAt
    ).toBeNull();
    expect(
      applyCredit(wallet(), EUR, "paid", "subscription_conversion", NOW).state.fundedAt
    ).toEqual(NOW);
  });

  it("refills a negative paid balance and clears zeroBalanceAt", () => {
    const s = wallet({ paidMicros: -2 * EUR, zeroBalanceAt: later(-DAY) });
    const out = applyCredit(s, 10 * EUR, "paid", "topup", NOW);
    expect(out.state.paidMicros).toBe(8 * EUR);
    expect(out.state.zeroBalanceAt).toBeNull();
    expect(out.recoveredFromZero).toBe(true);
    const small = applyCredit(
      wallet({ paidMicros: -2 * EUR, zeroBalanceAt: NOW }),
      EUR,
      "paid",
      "topup",
      NOW
    );
    expect(small.state.zeroBalanceAt).toEqual(NOW); // still <= 0
    expect(small.recoveredFromZero).toBe(false);
  });

  it("sets the promo expiry; the earliest dated expiry wins on a live promo", () => {
    const a = applyCredit(wallet(), 10 * EUR, "promo", "signup_credit", NOW, later(30 * DAY));
    expect(a.state).toMatchObject({ promoMicros: 10 * EUR, promoExpiresAt: later(30 * DAY) });
    const b = applyCredit(a.state, 5 * EUR, "promo", "admin_grant", NOW, later(10 * DAY));
    expect(b.state).toMatchObject({ promoMicros: 15 * EUR, promoExpiresAt: later(10 * DAY) });
    // A longer or non-expiring grant never extends the 30-day sign-up credit.
    const c = applyCredit(a.state, 5 * EUR, "promo", "admin_grant", NOW, later(60 * DAY));
    expect(c.state.promoExpiresAt).toEqual(later(30 * DAY));
    const d = applyCredit(a.state, 5 * EUR, "promo", "admin_grant", NOW, null);
    expect(d.state.promoExpiresAt).toEqual(later(30 * DAY));
    // A dated grant on top of a never-expiring promo dates the bucket.
    const e = applyCredit(d.state, 1 * EUR, "promo", "admin_grant", NOW, null);
    expect(e.state.promoExpiresAt).toEqual(later(30 * DAY));
    const f = applyCredit(
      wallet({ promoMicros: 2 * EUR, promoExpiresAt: null }),
      EUR,
      "promo",
      "admin_grant",
      NOW,
      later(DAY)
    );
    expect(f.state.promoExpiresAt).toEqual(later(DAY));
  });

  it("writes off an expired promo before adding a new one", () => {
    const s = wallet({ promoMicros: 3 * EUR, promoExpiresAt: later(-DAY) });
    const out = applyCredit(s, 10 * EUR, "promo", "admin_grant", NOW, later(DAY));
    expect(out.lines.map((l) => [l.kind, l.deltaMicros])).toEqual([
      ["promo_expiry", -3 * EUR],
      ["admin_grant", 10 * EUR],
    ]);
    expect(out.state).toMatchObject({ promoMicros: 10 * EUR, promoExpiresAt: later(DAY) });
  });

  it("rejects a promo that is already expired and bad amounts", () => {
    expect(() => applyCredit(wallet(), EUR, "promo", "signup_credit", NOW, later(-1))).toThrow(
      RangeError
    );
    expect(() => applyCredit(wallet(), 0, "paid", "topup", NOW)).toThrow(RangeError);
    expect(() => applyCredit(wallet(), 0.5, "paid", "topup", NOW)).toThrow(RangeError);
  });
});

describe("applyExpiry", () => {
  it("is a no-op for live, empty or undated promos", () => {
    for (const s of [
      wallet({ promoMicros: 5, promoExpiresAt: later(1) }),
      wallet({ promoMicros: 0, promoExpiresAt: later(-1) }),
      wallet({ promoMicros: 5, promoExpiresAt: null }),
    ]) {
      expect(applyExpiry(s, NOW).lines).toEqual([]);
    }
  });

  it("zeroes promo and records the write-off", () => {
    const out = applyExpiry(
      wallet({ paidMicros: 0, promoMicros: 10 * EUR, promoExpiresAt: NOW }),
      NOW
    );
    expect(out.state.promoMicros).toBe(0);
    expect(out.state.zeroBalanceAt).toEqual(NOW);
    expect(out.lines).toEqual([
      { bucket: "promo", kind: "promo_expiry", deltaMicros: -10 * EUR, balanceAfterMicros: 0 },
    ]);
  });
});

describe("ledgerRowsFor", () => {
  it("keys the first line with the caller's key and suffixes a split", () => {
    const rows = ledgerRowsFor(
      [
        { bucket: "promo", kind: "promo_expiry", deltaMicros: -1, balanceAfterMicros: 5 },
        { bucket: "promo", kind: "usage_compute", deltaMicros: -2, balanceAfterMicros: 3 },
        { bucket: "paid", kind: "usage_compute", deltaMicros: -4, balanceAfterMicros: -1 },
      ],
      { userId: "u1", idempotencyKey: "k1", units: { cpuNs: 5 }, note: "n" },
      () => "fixed"
    );
    expect(rows.map((r) => r.idempotencyKey)).toEqual(["promo_expiry:u1:fixed", "k1", "k1#paid"]);
    expect(rows[1]).toMatchObject({ units: { cpuNs: 5 }, note: "n", stripeRef: null });
    expect(rows[0].units).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// debitWith / creditWith through an in-memory store
// ---------------------------------------------------------------------------

/** Postgres-like in-memory wallet: a per-user lock (FOR UPDATE) and all-or-nothing commits. */
function memoryDb() {
  const accounts = new Map<string, WalletState>();
  const ledger: NewLedgerRow[] = [];
  const locks = new Map<string, Promise<void>>();
  const tick = () =>
    new Promise<void>((r) => (Math.random() < 0.5 ? queueMicrotask(r) : setTimeout(r, 0)));

  const run: WalletRunner = async (fn) => {
    let release: () => void = () => {};
    let lockedUser: string | null = null;
    const pendingRows: NewLedgerRow[] = [];
    let pendingSave: [string, WalletState] | null = null;
    const store: WalletStore = {
      async lock(userId) {
        while (locks.has(userId)) await locks.get(userId);
        locks.set(userId, new Promise<void>((r) => (release = r)));
        lockedUser = userId;
        await tick();
        return { ...(accounts.get(userId) ?? emptyWalletState()) };
      },
      async hasKey(key) {
        await tick();
        return ledger.some((r) => r.idempotencyKey === key);
      },
      async insert(rows) {
        await tick();
        for (const r of rows) {
          if (ledger.some((x) => x.idempotencyKey === r.idempotencyKey)) {
            throw Object.assign(new Error("duplicate key"), { code: "23505" });
          }
        }
        pendingRows.push(...rows);
      },
      async save(userId, state) {
        await tick();
        pendingSave = [userId, { ...state }];
      },
    };
    try {
      const result = await fn(store);
      ledger.push(...pendingRows); // commit
      if (pendingSave) accounts.set(pendingSave[0], pendingSave[1]);
      return result;
    } finally {
      if (lockedUser) locks.delete(lockedUser);
      release();
    }
  };
  return { run, accounts, ledger };
}

describe("debitWith / creditWith", () => {
  it("grants, spends promo first and is idempotent", async () => {
    const db = memoryDb();
    const grant = {
      userId: "u1",
      amountMicros: 10 * EUR,
      bucket: "promo" as const,
      kind: "signup_credit" as const,
      idempotencyKey: "signup:u1",
      expiresAt: later(30 * DAY),
    };
    expect(await creditWith(db.run, grant, NOW)).toEqual({
      applied: true,
      totalMicros: 10 * EUR,
      recoveredFromZero: true,
    });
    expect(await creditWith(db.run, grant, NOW)).toEqual({
      applied: false,
      totalMicros: 10 * EUR,
      recoveredFromZero: false,
    });

    await creditWith(
      db.run,
      {
        userId: "u1",
        amountMicros: 20 * EUR,
        bucket: "paid",
        kind: "topup",
        idempotencyKey: "topup:cs_1",
        stripeRef: "pi_1",
      },
      NOW
    );
    const d = await debitWith(
      db.run,
      { userId: "u1", amountMicros: 12 * EUR, kind: "usage_compute", idempotencyKey: "compute:1" },
      NOW
    );
    expect(d).toEqual({
      applied: true,
      totalMicros: 18 * EUR,
      crossedZero: false,
      crossedThreshold: false,
    });
    expect(db.accounts.get("u1")).toMatchObject({ promoMicros: 0, paidMicros: 18 * EUR });
    expect(db.ledger.map((r) => r.idempotencyKey)).toEqual([
      "signup:u1",
      "topup:cs_1",
      "compute:1",
      "compute:1#paid",
    ]);
    expect(db.ledger[1].stripeRef).toBe("pi_1");

    const dup = await debitWith(
      db.run,
      { userId: "u1", amountMicros: 12 * EUR, kind: "usage_compute", idempotencyKey: "compute:1" },
      NOW
    );
    expect(dup.applied).toBe(false);
    expect(dup.totalMicros).toBe(18 * EUR);
    expect(db.ledger).toHaveLength(4);
  });

  it("ledger balance_after and deltas always reconcile with the stored wallet", async () => {
    const db = memoryDb();
    await creditWith(
      db.run,
      {
        userId: "u",
        amountMicros: 10 * EUR,
        bucket: "promo",
        kind: "signup_credit",
        idempotencyKey: "s",
        expiresAt: later(DAY),
      },
      NOW
    );
    for (let i = 0; i < 20; i++) {
      await debitWith(
        db.run,
        {
          userId: "u",
          amountMicros: 400_000 + i,
          kind: "usage_tool_call",
          idempotencyKey: `c${i}`,
        },
        NOW
      );
    }
    // after expiry, the next debit writes the expired remainder off
    await debitWith(
      db.run,
      { userId: "u", amountMicros: 1, kind: "usage_tool_call", idempotencyKey: "late" },
      later(2 * DAY)
    );
    const acct = db.accounts.get("u")!;
    const sum = db.ledger.reduce((a, r) => a + r.deltaMicros, 0);
    expect(acct.paidMicros + acct.promoMicros).toBe(sum);
    expect(db.ledger[db.ledger.length - 1].balanceAfterMicros).toBe(
      acct.paidMicros + acct.promoMicros
    );
    expect(acct.promoMicros).toBe(0);
    expect(db.ledger.some((r) => r.kind === "promo_expiry")).toBe(true);
  });

  it("serializes concurrent debits: no lost update, no double spend", async () => {
    const db = memoryDb();
    await creditWith(
      db.run,
      {
        userId: "u",
        amountMicros: 5 * EUR,
        bucket: "promo",
        kind: "signup_credit",
        idempotencyKey: "s",
        expiresAt: later(DAY),
      },
      NOW
    );
    await creditWith(
      db.run,
      { userId: "u", amountMicros: 5 * EUR, bucket: "paid", kind: "topup", idempotencyKey: "t" },
      NOW
    );
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        debitWith(
          db.run,
          { userId: "u", amountMicros: 300_000, kind: "usage_tool_call", idempotencyKey: `k${i}` },
          NOW
        )
      )
    );
    expect(results.every((r) => r.applied)).toBe(true);
    const acct = db.accounts.get("u")!;
    expect(acct.promoMicros + acct.paidMicros).toBe(10 * EUR - 50 * 300_000); // -€5
    expect(acct.promoMicros).toBe(0);
    expect(acct.paidMicros).toBe(-5 * EUR);
    // exactly one debit crossed zero, exactly one crossed the €5 threshold
    expect(results.filter((r) => r.crossedZero)).toHaveLength(1);
    expect(results.filter((r) => r.crossedThreshold)).toHaveLength(1);
    // balances after each row form a strictly decreasing chain
    const afters = db.ledger.slice(2).map((r) => r.balanceAfterMicros);
    for (let i = 1; i < afters.length; i++) expect(afters[i]).toBeLessThan(afters[i - 1]);
  });

  it("concurrent retries of the same key apply once", async () => {
    const db = memoryDb();
    await creditWith(
      db.run,
      { userId: "u", amountMicros: 10 * EUR, bucket: "paid", kind: "topup", idempotencyKey: "t" },
      NOW
    );
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        debitWith(
          db.run,
          { userId: "u", amountMicros: EUR, kind: "usage_tool_call", idempotencyKey: "same" },
          NOW
        )
      )
    );
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(db.accounts.get("u")!.paidMicros).toBe(9 * EUR);
  });

  it("keeps users independent", async () => {
    const db = memoryDb();
    await Promise.all([
      creditWith(
        db.run,
        { userId: "a", amountMicros: EUR, bucket: "paid", kind: "topup", idempotencyKey: "a1" },
        NOW
      ),
      creditWith(
        db.run,
        { userId: "b", amountMicros: 2 * EUR, bucket: "paid", kind: "topup", idempotencyKey: "b1" },
        NOW
      ),
    ]);
    expect(db.accounts.get("a")!.paidMicros).toBe(EUR);
    expect(db.accounts.get("b")!.paidMicros).toBe(2 * EUR);
  });

  it("rejects wrong kinds, empty keys and bad amounts before touching the store", async () => {
    const db = memoryDb();
    await expect(
      debitWith(
        db.run,
        { userId: "u", amountMicros: 1, kind: "topup" as never, idempotencyKey: "x" },
        NOW
      )
    ).rejects.toThrow(RangeError);
    await expect(
      creditWith(
        db.run,
        {
          userId: "u",
          amountMicros: 1,
          bucket: "paid",
          kind: "usage_compute" as never,
          idempotencyKey: "x",
        },
        NOW
      )
    ).rejects.toThrow(RangeError);
    await expect(
      debitWith(
        db.run,
        { userId: "u", amountMicros: 1, kind: "usage_compute", idempotencyKey: " " },
        NOW
      )
    ).rejects.toThrow(RangeError);
    await expect(
      debitWith(
        db.run,
        { userId: "u", amountMicros: -1, kind: "usage_compute", idempotencyKey: "x" },
        NOW
      )
    ).rejects.toThrow(RangeError);
    expect(db.ledger).toHaveLength(0);
    expect(db.accounts.size).toBe(0);
  });

  it("rolls back the whole operation when a write fails", async () => {
    const db = memoryDb();
    const failing: WalletRunner = (fn) =>
      db.run((store) =>
        fn({
          ...store,
          save: async () => {
            throw new Error("boom");
          },
        })
      );
    await expect(
      creditWith(
        failing,
        { userId: "u", amountMicros: EUR, bucket: "paid", kind: "topup", idempotencyKey: "t" },
        NOW
      )
    ).rejects.toThrow("boom");
    expect(db.ledger).toHaveLength(0);
    expect(db.accounts.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Views, cursor, helpers
// ---------------------------------------------------------------------------

function row(over: Partial<WalletAccountRow> = {}): WalletAccountRow {
  return {
    userId: "u",
    paidMicros: 0,
    promoMicros: 0,
    promoExpiresAt: null,
    autoRechargeEnabled: false,
    autoRechargeThresholdMicros: 5_000_000,
    autoRechargeAmountMicros: 20_000_000,
    autoRechargeMonthlyCapMicros: 100_000_000,
    stripePaymentMethodId: null,
    fundedAt: null,
    zeroBalanceAt: null,
    notified: {},
    updatedAt: NOW,
    ...over,
  };
}

describe("walletViewFromRow", () => {
  it("returns an empty unfunded wallet without a row", () => {
    const v = walletViewFromRow(undefined, NOW);
    expect(v).toMatchObject({ totalMicros: 0, funded: false, promoMicros: 0 });
    expect(v.autoRecharge).toEqual({
      enabled: false,
      thresholdMicros: 5_000_000,
      amountMicros: 20_000_000,
      monthlyCapMicros: 100_000_000,
      hasPaymentMethod: false,
    });
  });

  it("hides expired promo from the total and reports it", () => {
    const v = walletViewFromRow(
      row({
        paidMicros: 2 * EUR,
        promoMicros: 10 * EUR,
        promoExpiresAt: later(-1),
        fundedAt: NOW,
        stripePaymentMethodId: "pm_1",
      }),
      NOW
    );
    expect(v).toMatchObject({
      promoMicros: 0,
      promoExpired: true,
      totalMicros: 2 * EUR,
      funded: true,
    });
    expect(v.autoRecharge.hasPaymentMethod).toBe(true);
  });

  it("coerces bigint strings from the driver", () => {
    const v = walletViewFromRow(row({ paidMicros: "1500000" as unknown as number }), NOW);
    expect(v.totalMicros).toBe(1_500_000);
  });
});

describe("ledger cursor", () => {
  it("round-trips a Postgres timestamptz text and id", () => {
    const c = encodeLedgerCursor(
      "2026-10-29 12:00:00.123456+00",
      "0b4a7c1e-1111-4222-8333-944445555666"
    );
    expect(decodeLedgerCursor(c)).toEqual({
      ts: "2026-10-29 12:00:00.123456+00",
      id: "0b4a7c1e-1111-4222-8333-944445555666",
    });
  });

  it("rejects tampered cursors", () => {
    expect(decodeLedgerCursor("not-base64-json")).toBeNull();
    expect(decodeLedgerCursor(encodeLedgerCursor("yesterday", "x"))).toBeNull();
    expect(decodeLedgerCursor(encodeLedgerCursor("2026-10-29 12:00:00+00", "x'; drop"))).toBeNull();
    expect(
      decodeLedgerCursor(
        Buffer.from(JSON.stringify(["2026-10-29 12:00:00+00"])).toString("base64url")
      )
    ).toBeNull();
  });
});

describe("isUniqueViolation", () => {
  it("finds 23505 on the error or its cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("x", { cause: { code: "23505" } }))).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("hasCredit", () => {
  it("fails closed when the database is unavailable", async () => {
    invalidateCreditCache();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await hasCredit("u-no-db")).toBe(false);
    spy.mockRestore();
  });

  it("caches per user, single-flights bursts and honours invalidation", async () => {
    invalidateCreditCache();
    fakeDb.fail = false;
    fakeDb.reads = 0;
    try {
      fakeDb.rows = [row({ userId: "c1", paidMicros: 1 })];
      const burst = await Promise.all(Array.from({ length: 20 }, () => hasCredit("c1")));
      expect(burst.every(Boolean)).toBe(true);
      expect(fakeDb.reads).toBe(1);

      fakeDb.rows = [row({ userId: "c1", paidMicros: 0 })];
      expect(await hasCredit("c1")).toBe(true); // cached for <= 5 s
      expect(fakeDb.reads).toBe(1);

      invalidateCreditCache("c1"); // a local debit/credit
      expect(await hasCredit("c1")).toBe(false);
      expect(fakeDb.reads).toBe(2);

      fakeDb.rows = []; // no wallet row: empty wallet
      invalidateCreditCache("c1");
      expect(await hasCredit("c1")).toBe(false);

      // expired promo does not count as credit
      fakeDb.rows = [
        row({ userId: "c1", promoMicros: 10 * EUR, promoExpiresAt: new Date(Date.now() - 1) }),
      ];
      invalidateCreditCache("c1");
      expect(await hasCredit("c1")).toBe(false);
      fakeDb.rows = [
        row({ userId: "c1", promoMicros: 10 * EUR, promoExpiresAt: new Date(Date.now() + DAY) }),
      ];
      invalidateCreditCache("c1");
      expect(await hasCredit("c1")).toBe(true);
    } finally {
      fakeDb.fail = true;
      invalidateCreditCache();
    }
  });
});

describe("overdraft floor (usage debits)", () => {
  it("capAtFloor splits what may be charged from what is written off", () => {
    expect(capAtFloor(2 * EUR, 1 * EUR, 500_000)).toEqual({
      chargeMicros: 1 * EUR,
      writtenOffMicros: 0,
    });
    // €0.20 left, €0.50 floor: €0.70 may still be charged.
    expect(capAtFloor(200_000, 1 * EUR, 500_000)).toEqual({
      chargeMicros: 700_000,
      writtenOffMicros: 300_000,
    });
    // Already at the floor: nothing more.
    expect(capAtFloor(-500_000, 1 * EUR, 500_000)).toEqual({
      chargeMicros: 0,
      writtenOffMicros: 1 * EUR,
    });
  });

  it("never takes the balance below -floor and records the write-off on the row", async () => {
    const db = memoryDb();
    await creditWith(
      db.run,
      {
        userId: "u1",
        amountMicros: 10 * EUR,
        bucket: "paid",
        kind: "topup",
        idempotencyKey: "topup:f1",
      },
      NOW
    );
    const big = await debitWith(
      db.run,
      {
        userId: "u1",
        amountMicros: 12 * EUR,
        kind: "usage_compute",
        idempotencyKey: "compute:f1",
        floorMicros: 500_000,
      },
      NOW
    );
    expect(big).toMatchObject({ applied: true, totalMicros: -500_000, crossedZero: true });
    expect(big.writtenOffMicros).toBe(1_500_000);
    const row = db.ledger.find((r) => r.idempotencyKey === "compute:f1");
    expect(row?.deltaMicros).toBe(-10_500_000);
    expect(row?.units).toMatchObject({ requestedMicros: 12 * EUR, writtenOffMicros: 1_500_000 });

    const more = await debitWith(
      db.run,
      {
        userId: "u1",
        amountMicros: 1 * EUR,
        kind: "usage_compute",
        idempotencyKey: "compute:f2",
        floorMicros: 500_000,
      },
      NOW
    );
    expect(more).toMatchObject({ applied: false, totalMicros: -500_000, writtenOffMicros: EUR });
    expect(db.ledger.some((r) => r.idempotencyKey === "compute:f2")).toBe(false);
    expect(db.accounts.get("u1")?.paidMicros).toBe(-500_000);
  });

  it("a debit without a floor (clawback) still goes as far as needed", async () => {
    const db = memoryDb();
    const d = await debitWith(
      db.run,
      {
        userId: "u1",
        amountMicros: 3 * EUR,
        kind: "clawback",
        bucket: "paid",
        idempotencyKey: "clawback:x",
      },
      NOW
    );
    expect(d.totalMicros).toBe(-3 * EUR);
  });
});
