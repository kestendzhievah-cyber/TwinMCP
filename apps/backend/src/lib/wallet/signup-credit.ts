import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { credit } from "./ledger";
import { PRICING, eurToMicros } from "./pricing";
import { hashEmail, normalizeEmail } from "./email-normalize";
import { isDisposableEmail } from "./disposable-domains";

// The €10 promotional sign-up credit (contract W4). Server-only.
//
// One grant per person, as far as cheap signals allow:
//   1. a confirmed, real address (the caller decides "confirmed"; a missing or
//      placeholder address is "unverified");
//   2. no throwaway domain (disposable-domains.ts);
//   3. one claim per CANONICAL address, hashed with a server pepper
//      (email-normalize.ts) and kept after the account is deleted, so deleting
//      and re-creating an account does not mint a second credit;
//   4. at most SIGNUP_CREDIT_MAX_PER_IP_DAY claims per client IP (default 3)
//      and SIGNUP_CREDIT_MAX_PER_SUBNET_DAY per /24 (IPv6: per /48; default 10)
//      over the last 24 hours, counted in signup_credit_claims.
// The claim row is written first (inside a transaction that serialises claims
// per subnet with an advisory lock), then the ledger credit is written with the
// idempotency key `signup_credit:<userId>`. If the credit write fails after the
// claim, the next call for the same user resumes and credits; it can never
// credit twice.

export type SignupCreditRefusal =
  | "duplicate_email"
  | "disposable_email"
  | "ip_limit"
  | "daily_cap"
  | "already_granted"
  | "unverified";

export interface SignupCreditResult {
  granted: boolean;
  reason?: SignupCreditRefusal;
}

export interface GrantSignupCreditInput {
  userId: string;
  email: string | null | undefined;
  ip: string | null | undefined;
  /** False when the identity provider has not confirmed the address. Default true. */
  emailVerified?: boolean;
}

/** Idempotency key of the sign-up credit ledger row. */
export function signupCreditKey(userId: string): string {
  return `signup_credit:${userId}`;
}

// ---------------------------------------------------------------------------
// When to claim (pure; used by lib/auth/post-auth.ts)

/**
 * A sign-in this long after the account was created no longer claims the
 * sign-up credit, so accounts that predate the wallet are not credited by a
 * login. Within it, a later sign-in retries a grant the first session could not
 * make (address not yet confirmed, row created by another path, DB hiccup).
 */
export const SIGNUP_CREDIT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

interface ConfirmableUser {
  email?: string | null;
  email_confirmed_at?: string | null;
  /** auth.users.created_at: tells a real confirmation from an auto-confirm. */
  created_at?: string | null;
  identities?: { provider: string; identity_data?: Record<string, unknown> | null }[] | null;
}

/**
 * An email/password account confirmed within this long of its creation was
 * auto-confirmed (Supabase "Confirm email" off): nobody clicked a link, so the
 * address is not proven to belong to the person claiming the credit.
 */
export const AUTOCONFIRM_SLACK_MS = 5_000;

/**
 * Whether Supabase vouches for the address. Only server-set fields count:
 * `email_confirmed_at` (set on confirmation, and for OAuth when the provider
 * reports a verified email), or an OAuth identity whose provider data marks
 * the same address verified. user_metadata is user-writable: never trusted.
 * An email-only account whose confirmation stamp equals its creation time was
 * auto-confirmed and does not count (free credit would otherwise be farmable
 * with addresses the claimant does not own).
 */
export function isEmailConfirmed(user: ConfirmableUser): boolean {
  if (!user.email) return false;
  const oauth = (user.identities ?? []).some((i) => i.provider !== "email");
  if (user.email_confirmed_at) {
    if (oauth) return true;
    const confirmed = Date.parse(user.email_confirmed_at);
    const created = user.created_at ? Date.parse(user.created_at) : NaN;
    if (!Number.isFinite(created) || !Number.isFinite(confirmed)) return true;
    return confirmed - created > AUTOCONFIRM_SLACK_MS;
  }
  const email = user.email.toLowerCase();
  return (user.identities ?? []).some((identity) => {
    if (identity.provider === "email") return false;
    const data = identity.identity_data ?? {};
    return (
      data.email_verified === true &&
      typeof data.email === "string" &&
      data.email.toLowerCase() === email
    );
  });
}

/** Whether this authenticated session should try to claim the sign-up credit. */
export function shouldClaimSignupCredit(input: {
  firstSession: boolean;
  createdAt: Date | null;
  now: Date;
  confirmed: boolean;
  realEmail: string | null;
}): boolean {
  if (!input.confirmed || !input.realEmail) return false;
  if (input.firstSession) return true;
  if (!input.createdAt) return false;
  return input.now.getTime() - input.createdAt.getTime() <= SIGNUP_CREDIT_GRACE_MS;
}

// ---------------------------------------------------------------------------
// IP keys (pure)

/**
 * The per-IP key stored in signup_credit_claims.ip_prefix and the subnet
 * prefix it is counted under:
 *   IPv4 1.2.3.4                → ip "1.2.3.4", subnet "1.2.3."
 *   IPv4-mapped ::ffff:1.2.3.4  → same as IPv4
 *   IPv6                        → ip = its /64 (each home gets a /64),
 *                                 subnet = its /48, in full 4-digit groups
 * Unknown or unparsable input → the shared "unknown" bucket.
 */
export function ipKeys(ip: string | null | undefined): { ip: string; subnet: string } {
  const UNKNOWN = { ip: "unknown", subnet: "unknown" };
  if (!ip) return UNKNOWN;
  let s = ip.trim().toLowerCase();
  // "[2001:db8::1]:443" / "1.2.3.4:443" / zone ids.
  if (s.startsWith("[")) s = s.slice(1, s.indexOf("]") > 0 ? s.indexOf("]") : undefined);
  const pct = s.indexOf("%");
  if (pct >= 0) s = s.slice(0, pct);
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(s)) s = s.slice(0, s.lastIndexOf(":"));

  const mapped = /^(?:0{0,4}:){0,5}:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) s = mapped[1];

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return UNKNOWN;
    return { ip: parts.join("."), subnet: `${parts.slice(0, 3).join(".")}.` };
  }

  const groups = expandIpv6(s);
  if (!groups) return UNKNOWN;
  return { ip: groups.slice(0, 4).join(":"), subnet: `${groups.slice(0, 3).join(":")}:` };
}

/** Eight zero-padded hex groups, or null when `s` is not an IPv6 address. */
function expandIpv6(s: string): string[] | null {
  if (!/^[0-9a-f:.]+$/.test(s) || !s.includes(":")) return null;
  // An embedded IPv4 tail counts as two groups.
  let addr = s;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (tail) {
    const o = tail[1].split(".").map(Number);
    if (o.some((n) => n > 255)) return null;
    const hex = (a: number, b: number) => ((a << 8) | b).toString(16);
    addr = `${addr.slice(0, -tail[1].length)}${hex(o[0], o[1])}:${hex(o[2], o[3])}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (all.length !== 8 || all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => g.padStart(4, "0"));
}

// ---------------------------------------------------------------------------
// Limits and the claim decision (pure)

export interface SignupIpLimits {
  perIpPerDay: number;
  perSubnetPerDay: number;
  /**
   * Circuit breaker: sign-up credits granted in the last 24 hours, all
   * networks together (SIGNUP_CREDIT_MAX_PER_DAY). Claims are serialised per
   * subnet, so concurrent claims from different networks may pass it by a few.
   */
  perDay?: number;
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function signupIpLimits(): SignupIpLimits {
  return {
    perIpPerDay: envInt("SIGNUP_CREDIT_MAX_PER_IP_DAY", 3),
    perSubnetPerDay: envInt("SIGNUP_CREDIT_MAX_PER_SUBNET_DAY", 10),
    perDay: envInt("SIGNUP_CREDIT_MAX_PER_DAY", 200),
  };
}

export type ClaimDecision = "claim" | "resume" | "duplicate_email" | "ip_limit" | "daily_cap";

/**
 * What to do with a claim attempt, given what the claims table already holds.
 * `emailOwner` is the user_id on an existing claim for the same canonical
 * address (undefined = no such claim; null = the claiming account was deleted).
 * Counts are claims of the last 24 hours, excluding this attempt.
 */
export function decideClaim(input: {
  userId: string;
  emailOwner: string | null | undefined;
  sameIp: number;
  sameSubnet: number;
  /** Claims of the last 24 hours, every network. Absent: no global cap check. */
  total?: number;
  limits: SignupIpLimits;
}): ClaimDecision {
  if (input.emailOwner !== undefined) {
    return input.emailOwner === input.userId ? "resume" : "duplicate_email";
  }
  if (input.sameIp >= input.limits.perIpPerDay) return "ip_limit";
  if (input.sameSubnet >= input.limits.perSubnetPerDay) return "ip_limit";
  if (
    input.limits.perDay !== undefined &&
    input.total !== undefined &&
    input.total >= input.limits.perDay
  ) {
    return "daily_cap";
  }
  return "claim";
}

// ---------------------------------------------------------------------------
// Storage (injectable so the money logic is testable without Postgres)

export interface ClaimTx {
  /** user_id of the claim for this email hash; undefined when there is none. */
  emailOwner(emailHash: string): Promise<string | null | undefined>;
  /** Whether this user already holds a claim (any address). */
  userHasClaim(userId: string): Promise<boolean>;
  /** Claims since `since`: same ip key, same subnet prefix, and (optionally) all. */
  countRecent(
    ip: string,
    subnet: string,
    since: Date
  ): Promise<{ sameIp: number; sameSubnet: number; total?: number }>;
  /** Insert; false when the email hash was claimed concurrently. */
  insert(row: { emailHash: string; userId: string; ip: string }): Promise<boolean>;
}

export interface ClaimStore {
  /** Run `fn` in one transaction holding an exclusive lock on `lockKey`. */
  withLock<T>(lockKey: string, fn: (tx: ClaimTx) => Promise<T>): Promise<T>;
}

/** Postgres implementation over signup_credit_claims (migration 0020). */
export const pgClaimStore: ClaimStore = {
  async withLock(lockKey, fn) {
    return getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const claimTx: ClaimTx = {
        async emailOwner(emailHash) {
          const rows = await tx.execute<{ user_id: string | null }>(
            sql`select user_id from signup_credit_claims where email_hash = ${emailHash} limit 1`
          );
          return rows.length > 0 ? rows[0].user_id : undefined;
        },
        async userHasClaim(userId) {
          const rows = await tx.execute(
            sql`select 1 from signup_credit_claims where user_id = ${userId} limit 1`
          );
          return rows.length > 0;
        },
        async countRecent(ip, subnet, since) {
          // ip/subnet hold only digits, hex, "." and ":" (or "unknown"): no
          // LIKE metacharacters to escape.
          const rows = await tx.execute<{
            same_ip: number;
            same_subnet: number;
            total: number;
          }>(sql`
            select
              count(*) filter (where ip_prefix = ${ip})::int as same_ip,
              count(*) filter (where ip_prefix like ${`${subnet}%`})::int as same_subnet,
              count(*)::int as total
            from signup_credit_claims
            where created_at > ${since.toISOString()}::timestamptz
          `);
          return {
            sameIp: Number(rows[0]?.same_ip ?? 0),
            sameSubnet: Number(rows[0]?.same_subnet ?? 0),
            total: Number(rows[0]?.total ?? 0),
          };
        },
        async insert(row) {
          const rows = await tx.execute(sql`
            insert into signup_credit_claims (email_hash, user_id, ip_prefix)
            values (${row.emailHash}, ${row.userId}, ${row.ip})
            on conflict (email_hash) do nothing
            returning email_hash
          `);
          return rows.length > 0;
        },
      };
      return fn(claimTx);
    });
  },
};

export interface SignupCreditDeps {
  store: ClaimStore;
  credit: typeof credit;
  now: () => Date;
  limits: SignupIpLimits;
  pepper?: string;
}

const PLACEHOLDER_SUFFIX = "@placeholder.twinmcp.fr";

function usableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const e = normalizeEmail(email);
  if (e.endsWith(PLACEHOLDER_SUFFIX)) return false;
  const at = e.lastIndexOf("@");
  return at > 0 && e.indexOf(".", at) > at + 1 && !e.endsWith(".");
}

/**
 * Grant the promotional sign-up credit (PRICING.signupCreditEur, expiring after
 * PRICING.signupCreditDays) at most once per person. Never throws for a
 * refusal; a database error is thrown (the caller logs it and lets sign-in go
 * on; the next sign-in retries).
 */
export async function grantSignupCredit(
  input: GrantSignupCreditInput,
  deps: Partial<SignupCreditDeps> = {}
): Promise<SignupCreditResult> {
  const store = deps.store ?? pgClaimStore;
  const creditFn = deps.credit ?? credit;
  const now = (deps.now ?? (() => new Date()))();
  const limits = deps.limits ?? signupIpLimits();

  if (input.emailVerified === false || !usableEmail(input.email)) {
    return { granted: false, reason: "unverified" };
  }
  const email = input.email;
  if (isDisposableEmail(normalizeEmail(email))) {
    return { granted: false, reason: "disposable_email" };
  }

  const emailHash = hashEmail(email, deps.pepper);
  const keys = ipKeys(input.ip);
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Serialise claims per subnet so concurrent sign-ups cannot all pass the
  // count before any of them is inserted.
  const decision = await store.withLock(`signup-credit:${keys.subnet}`, async (tx) => {
    // A user who already holds a claim (repeat sign-in, or a crash between the
    // claim and the credit) resumes: the credit below is idempotent.
    if (await tx.userHasClaim(input.userId)) return "resume" as const;
    const emailOwner = await tx.emailOwner(emailHash);
    const counts =
      emailOwner === undefined
        ? await tx.countRecent(keys.ip, keys.subnet, since)
        : { sameIp: 0, sameSubnet: 0 };
    const d = decideClaim({ userId: input.userId, emailOwner, ...counts, limits });
    if (d !== "claim") return d;
    const inserted = await tx.insert({ emailHash, userId: input.userId, ip: keys.ip });
    return inserted ? ("claim" as const) : ("duplicate_email" as const);
  });

  if (decision === "duplicate_email" || decision === "ip_limit" || decision === "daily_cap") {
    return { granted: false, reason: decision };
  }

  const expiresAt = new Date(now.getTime() + PRICING.signupCreditDays * 24 * 60 * 60 * 1000);
  const res = await creditFn({
    userId: input.userId,
    amountMicros: eurToMicros(PRICING.signupCreditEur),
    bucket: "promo",
    kind: "signup_credit",
    idempotencyKey: signupCreditKey(input.userId),
    expiresAt,
    note: `Sign-up credit, valid ${PRICING.signupCreditDays} days`,
  });
  return res.applied ? { granted: true } : { granted: false, reason: "already_granted" };
}
