import { describe, it, expect, vi, beforeEach } from "vitest";

// The ledger's real credit() needs Postgres; every test injects its own.
vi.mock("./ledger", () => ({ credit: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));

import {
  decideClaim,
  grantSignupCredit,
  ipKeys,
  isEmailConfirmed,
  shouldClaimSignupCredit,
  signupCreditKey,
  SIGNUP_CREDIT_GRACE_MS,
  type ClaimStore,
  type ClaimTx,
  type SignupCreditDeps,
} from "./signup-credit";
import { hashEmail } from "./email-normalize";
import type { CreditInput, CreditResult } from "./ledger";

const PEPPER = "test-pepper";
const NOW = new Date("2026-10-29T12:00:00Z");
const LIMITS = { perIpPerDay: 3, perSubnetPerDay: 10 };

interface Claim {
  emailHash: string;
  userId: string;
  ip: string;
  createdAt: Date;
}

/** In-memory claims table with the same semantics as the Postgres store. */
function memoryStore(now: () => Date) {
  const claims: Claim[] = [];
  const locks: string[] = [];
  const tx: ClaimTx = {
    async emailOwner(hash) {
      const c = claims.find((x) => x.emailHash === hash);
      return c ? c.userId : undefined;
    },
    async userHasClaim(userId) {
      return claims.some((x) => x.userId === userId);
    },
    async countRecent(ip, subnet, since) {
      const recent = claims.filter((c) => c.createdAt > since && c.ip.startsWith(subnet));
      const all = claims.filter((c) => c.createdAt > since);
      return {
        sameIp: recent.filter((c) => c.ip === ip).length,
        sameSubnet: recent.length,
        total: all.length,
      };
    },
    async insert(row) {
      if (claims.some((c) => c.emailHash === row.emailHash)) return false;
      claims.push({ ...row, createdAt: now() });
      return true;
    },
  };
  const store: ClaimStore = {
    async withLock(key, fn) {
      locks.push(key);
      return fn(tx);
    },
  };
  return { store, claims, locks };
}

/** Fake ledger: idempotent on the key, like the real one. */
function fakeLedger() {
  const keys = new Map<string, CreditInput>();
  const credit = vi.fn(async (input: CreditInput): Promise<CreditResult> => {
    if (keys.has(input.idempotencyKey)) {
      return { applied: false, totalMicros: input.amountMicros, recoveredFromZero: false };
    }
    keys.set(input.idempotencyKey, input);
    return { applied: true, totalMicros: input.amountMicros, recoveredFromZero: false };
  });
  return { credit, keys };
}

describe("ipKeys", () => {
  it.each([
    ["1.2.3.4", "1.2.3.4", "1.2.3."],
    [" 81.250.12.7 ", "81.250.12.7", "81.250.12."],
    ["1.2.3.4:443", "1.2.3.4", "1.2.3."],
    ["::ffff:1.2.3.4", "1.2.3.4", "1.2.3."],
    ["0:0:0:0:0:ffff:1.2.3.4", "1.2.3.4", "1.2.3."],
    ["2001:db8:1:2:3:4:5:6", "2001:0db8:0001:0002", "2001:0db8:0001:"],
    ["2001:DB8:1:2::1", "2001:0db8:0001:0002", "2001:0db8:0001:"],
    ["[2001:db8:1:2::1]:8443", "2001:0db8:0001:0002", "2001:0db8:0001:"],
    ["fe80::1%eth0", "fe80:0000:0000:0000", "fe80:0000:0000:"],
    ["::1", "0000:0000:0000:0000", "0000:0000:0000:"],
  ])("%j → ip %j, subnet %j", (raw, ip, subnet) => {
    expect(ipKeys(raw)).toEqual({ ip, subnet });
  });

  it.each([[null], [undefined], [""], ["not-an-ip"], ["999.1.1.1"], ["1:2:3"], ["1::2::3"]])(
    "%j → the shared unknown bucket",
    (raw) => {
      expect(ipKeys(raw)).toEqual({ ip: "unknown", subnet: "unknown" });
    }
  );

  it("puts two IPv6 hosts of one /64 on the same ip key", () => {
    expect(ipKeys("2a01:cb00:1:2::aaaa").ip).toBe(ipKeys("2a01:cb00:1:2::bbbb").ip);
    expect(ipKeys("2a01:cb00:1:3::1").ip).not.toBe(ipKeys("2a01:cb00:1:2::1").ip);
    expect(ipKeys("2a01:cb00:1:3::1").subnet).toBe(ipKeys("2a01:cb00:1:2::1").subnet);
  });
});

describe("decideClaim", () => {
  const base = { userId: "u1", emailOwner: undefined, sameIp: 0, sameSubnet: 0, limits: LIMITS };

  it("claims when the address is new and under both limits", () => {
    expect(decideClaim(base)).toBe("claim");
    expect(decideClaim({ ...base, sameIp: 2, sameSubnet: 9 })).toBe("claim");
  });

  it("refuses at 3 per IP and at 10 per subnet", () => {
    expect(decideClaim({ ...base, sameIp: 3, sameSubnet: 3 })).toBe("ip_limit");
    expect(decideClaim({ ...base, sameIp: 0, sameSubnet: 10 })).toBe("ip_limit");
  });

  it("resumes the same user's claim, refuses another user's", () => {
    expect(decideClaim({ ...base, emailOwner: "u1", sameIp: 99 })).toBe("resume");
    expect(decideClaim({ ...base, emailOwner: "u2" })).toBe("duplicate_email");
    expect(decideClaim({ ...base, emailOwner: null })).toBe("duplicate_email");
  });
});

describe("grantSignupCredit", () => {
  let mem: ReturnType<typeof memoryStore>;
  let ledger: ReturnType<typeof fakeLedger>;
  let clock: Date;
  let deps: Partial<SignupCreditDeps>;

  beforeEach(() => {
    clock = NOW;
    mem = memoryStore(() => clock);
    ledger = fakeLedger();
    deps = {
      store: mem.store,
      credit: ledger.credit as unknown as SignupCreditDeps["credit"],
      now: () => clock,
      limits: LIMITS,
      pepper: PEPPER,
    };
  });

  const grant = (userId: string, email: string | null, ip: string | null = "81.250.12.7") =>
    grantSignupCredit({ userId, email, ip }, deps);

  it("grants €10 of promo credit valid 30 days, keyed per user", async () => {
    expect(await grant("u1", "jane@example.com")).toEqual({ granted: true });
    expect(ledger.credit).toHaveBeenCalledTimes(1);
    const input = ledger.credit.mock.calls[0][0];
    expect(input).toMatchObject({
      userId: "u1",
      amountMicros: 10_000_000,
      bucket: "promo",
      kind: "signup_credit",
      idempotencyKey: signupCreditKey("u1"),
    });
    expect(input.expiresAt?.toISOString()).toBe("2026-11-28T12:00:00.000Z");
    expect(mem.claims).toHaveLength(1);
    expect(mem.claims[0]).toMatchObject({
      userId: "u1",
      ip: "81.250.12.7",
      emailHash: hashEmail("jane@example.com", PEPPER),
    });
    // Serialised per subnet.
    expect(mem.locks).toEqual(["signup-credit:81.250.12."]);
  });

  it("is idempotent: a repeat sign-in is already_granted and writes nothing new", async () => {
    await grant("u1", "jane@example.com");
    expect(await grant("u1", "jane@example.com")).toEqual({
      granted: false,
      reason: "already_granted",
    });
    expect(mem.claims).toHaveLength(1);
    expect(ledger.keys.size).toBe(1);
  });

  it("resumes when the credit failed after the claim was written", async () => {
    ledger.credit.mockRejectedValueOnce(new Error("db down"));
    await expect(grant("u1", "jane@example.com")).rejects.toThrow("db down");
    expect(mem.claims).toHaveLength(1);
    expect(ledger.keys.size).toBe(0);
    // Next sign-in: same user, claim already held → credit goes through once.
    expect(await grant("u1", "jane@example.com")).toEqual({ granted: true });
    expect(ledger.keys.size).toBe(1);
  });

  it("refuses an alias of an address that already claimed (another account)", async () => {
    await grant("u1", "john.smith@gmail.com");
    expect(await grant("u2", "John.Smith+again@googlemail.com", "9.9.9.9")).toEqual({
      granted: false,
      reason: "duplicate_email",
    });
    expect(ledger.keys.has(signupCreditKey("u2"))).toBe(false);
  });

  it("refuses throwaway domains before touching the claims table", async () => {
    expect(await grant("u1", "x@mailinator.com")).toEqual({
      granted: false,
      reason: "disposable_email",
    });
    expect(await grant("u2", "x@inbox.yopmail.com")).toEqual({
      granted: false,
      reason: "disposable_email",
    });
    expect(mem.claims).toHaveLength(0);
    expect(ledger.credit).not.toHaveBeenCalled();
  });

  it.each([
    [null, true],
    ["", true],
    ["u1@placeholder.twinmcp.fr", true],
    ["not-an-email", true],
    ["jane@localhost", true],
    ["jane@example.com", false],
  ])("%j with emailVerified=%j handling", async (email, unverified) => {
    const res = await grant("u1", email as string | null);
    if (unverified) expect(res).toEqual({ granted: false, reason: "unverified" });
    else expect(res.granted).toBe(true);
  });

  it("refuses when the caller says the address is not confirmed", async () => {
    expect(
      await grantSignupCredit(
        { userId: "u1", email: "jane@example.com", ip: "1.2.3.4", emailVerified: false },
        deps
      )
    ).toEqual({ granted: false, reason: "unverified" });
    expect(mem.claims).toHaveLength(0);
  });

  it("allows 3 grants per IP per day, then refuses", async () => {
    for (let i = 1; i <= 3; i++) {
      expect(await grant(`u${i}`, `user${i}@example.com`, "5.6.7.8")).toEqual({ granted: true });
    }
    expect(await grant("u4", "user4@example.com", "5.6.7.8")).toEqual({
      granted: false,
      reason: "ip_limit",
    });
    // A refused attempt leaves no claim: the address can still claim elsewhere.
    expect(await grant("u4", "user4@example.com", "8.8.4.4")).toEqual({ granted: true });
  });

  it("allows 10 grants per /24 per day across different IPs, then refuses", async () => {
    for (let i = 1; i <= 10; i++) {
      expect(await grant(`u${i}`, `user${i}@example.com`, `5.6.7.${i}`)).toEqual({
        granted: true,
      });
    }
    expect(await grant("u11", "user11@example.com", "5.6.7.200")).toEqual({
      granted: false,
      reason: "ip_limit",
    });
    // Another /24 is unaffected.
    expect(await grant("u12", "user12@example.com", "5.6.8.1")).toEqual({ granted: true });
  });

  it("counts only the last 24 hours", async () => {
    for (let i = 1; i <= 3; i++) await grant(`u${i}`, `user${i}@example.com`, "5.6.7.8");
    clock = new Date(NOW.getTime() + 24 * 60 * 60 * 1000 + 1000);
    expect(await grant("u4", "user4@example.com", "5.6.7.8")).toEqual({ granted: true });
  });

  it("applies the IPv6 limits per /64", async () => {
    for (let i = 1; i <= 3; i++) {
      await grant(`u${i}`, `user${i}@example.com`, `2a01:cb00:1:2::${i}`);
    }
    expect(await grant("u4", "user4@example.com", "2a01:cb00:1:2::99")).toEqual({
      granted: false,
      reason: "ip_limit",
    });
    expect(await grant("u5", "user5@example.com", "2a01:cb00:1:3::1")).toEqual({ granted: true });
  });

  it("puts unknown IPs in one shared bucket (still limited)", async () => {
    for (let i = 1; i <= 3; i++) await grant(`u${i}`, `user${i}@example.com`, null);
    expect(await grant("u4", "user4@example.com", null)).toEqual({
      granted: false,
      reason: "ip_limit",
    });
  });

  it("an address whose account was deleted cannot claim again", async () => {
    await grant("u1", "jane@example.com");
    // The claim outlives the account (no FK): a new account with the same inbox.
    expect(await grant("u9", "jane@example.com", "7.7.7.7")).toEqual({
      granted: false,
      reason: "duplicate_email",
    });
  });
});

describe("isEmailConfirmed", () => {
  it("trusts email_confirmed_at", () => {
    expect(isEmailConfirmed({ email: "a@b.co", email_confirmed_at: "2026-10-29T00:00:00Z" })).toBe(
      true
    );
    expect(isEmailConfirmed({ email: "a@b.co", email_confirmed_at: null })).toBe(false);
    expect(isEmailConfirmed({ email: null, email_confirmed_at: "2026-10-29T00:00:00Z" })).toBe(
      false
    );
  });

  it("trusts an OAuth identity that verified the same address", () => {
    const user = {
      email: "Jane@Example.com",
      identities: [
        { provider: "google", identity_data: { email: "jane@example.com", email_verified: true } },
      ],
    };
    expect(isEmailConfirmed(user)).toBe(true);
  });

  it("does not count an auto-confirmed email/password account (confirmed at creation)", () => {
    const base = { email: "a@b.co", created_at: "2026-10-29T00:00:00.000Z" };
    expect(isEmailConfirmed({ ...base, email_confirmed_at: "2026-10-29T00:00:00.400Z" })).toBe(
      false
    );
    expect(isEmailConfirmed({ ...base, email_confirmed_at: "2026-10-29T00:03:12.000Z" })).toBe(
      true
    );
    // OAuth: the provider vouches at creation.
    expect(
      isEmailConfirmed({
        ...base,
        email_confirmed_at: "2026-10-29T00:00:00.000Z",
        identities: [{ provider: "google", identity_data: {} }],
      })
    ).toBe(true);
  });

  it("ignores unverified, mismatched or email-provider identities", () => {
    const mk = (provider: string, data: Record<string, unknown>) => ({
      email: "jane@example.com",
      identities: [{ provider, identity_data: data }],
    });
    expect(
      isEmailConfirmed(mk("github", { email: "jane@example.com", email_verified: false }))
    ).toBe(false);
    expect(
      isEmailConfirmed(mk("github", { email: "other@example.com", email_verified: true }))
    ).toBe(false);
    expect(isEmailConfirmed(mk("email", { email: "jane@example.com", email_verified: true }))).toBe(
      false
    );
    expect(
      isEmailConfirmed(mk("github", { email: "jane@example.com", email_verified: "true" }))
    ).toBe(false);
  });
});

describe("shouldClaimSignupCredit", () => {
  const base = {
    firstSession: false,
    createdAt: new Date(NOW.getTime() - 60_000),
    now: NOW,
    confirmed: true,
    realEmail: "jane@example.com",
  };

  it("claims on the first session with a confirmed address", () => {
    expect(shouldClaimSignupCredit({ ...base, firstSession: true, createdAt: null })).toBe(true);
  });

  it("never claims without a confirmed real address", () => {
    expect(shouldClaimSignupCredit({ ...base, firstSession: true, confirmed: false })).toBe(false);
    expect(shouldClaimSignupCredit({ ...base, firstSession: true, realEmail: null })).toBe(false);
  });

  it("retries on later sign-ins within the grace window only", () => {
    expect(shouldClaimSignupCredit(base)).toBe(true);
    const old = new Date(NOW.getTime() - SIGNUP_CREDIT_GRACE_MS - 1);
    expect(shouldClaimSignupCredit({ ...base, createdAt: old })).toBe(false);
    expect(shouldClaimSignupCredit({ ...base, createdAt: null })).toBe(false);
  });
});

describe("decideClaim — global daily circuit breaker", () => {
  const limits = { perIpPerDay: 3, perSubnetPerDay: 10, perDay: 2 };
  it("refuses new claims once the day's total reaches the cap", () => {
    expect(
      decideClaim({
        userId: "u",
        emailOwner: undefined,
        sameIp: 0,
        sameSubnet: 0,
        total: 1,
        limits,
      })
    ).toBe("claim");
    expect(
      decideClaim({
        userId: "u",
        emailOwner: undefined,
        sameIp: 0,
        sameSubnet: 0,
        total: 2,
        limits,
      })
    ).toBe("daily_cap");
  });
  it("a resume is never blocked by the cap", () => {
    expect(
      decideClaim({ userId: "u", emailOwner: "u", sameIp: 9, sameSubnet: 9, total: 99, limits })
    ).toBe("resume");
  });
});
