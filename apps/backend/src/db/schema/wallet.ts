import {
  pgTable,
  text,
  timestamp,
  jsonb,
  bigint,
  boolean,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./core";

// Prepaid wallet (contract W1). Money is integer MICRO-EUROS (€1 = 1_000_000)
// in bigint columns read as JS numbers: 2^53 micro-euros is ~€9 billion, far
// beyond any balance, and number keeps the arithmetic plain (no floats: every
// value written is an integer). Balances live ONLY in Postgres (prod Redis is
// down; money must fail closed) and every change is a credit_ledger row with a
// unique idempotency key, so a retried webhook or flush is a no-op.

export const walletBuckets = ["paid", "promo"] as const;
export type WalletBucket = (typeof walletBuckets)[number];

export const ledgerKinds = [
  "signup_credit",
  "topup",
  "auto_recharge",
  "admin_grant",
  "subscription_conversion",
  "usage_tool_call",
  "usage_compute",
  "clawback",
  "promo_expiry",
  "adjustment",
] as const;
export type LedgerKind = (typeof ledgerKinds)[number];

/**
 * One row per user, created lazily by the first credit/debit (lib/wallet/ledger.ts).
 * paid_micros may go negative (usage that already happened is still charged);
 * promo_micros never does. The promo bucket is spent first and stops counting
 * at promo_expires_at (the expiry cron then writes a promo_expiry row).
 */
export const walletAccounts = pgTable("wallet_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  paidMicros: bigint("paid_micros", { mode: "number" }).notNull().default(0),
  promoMicros: bigint("promo_micros", { mode: "number" }).notNull().default(0),
  promoExpiresAt: timestamp("promo_expires_at", { withTimezone: true }),
  autoRechargeEnabled: boolean("auto_recharge_enabled").notNull().default(false),
  autoRechargeThresholdMicros: bigint("auto_recharge_threshold_micros", { mode: "number" })
    .notNull()
    .default(5_000_000),
  autoRechargeAmountMicros: bigint("auto_recharge_amount_micros", { mode: "number" })
    .notNull()
    .default(20_000_000),
  autoRechargeMonthlyCapMicros: bigint("auto_recharge_monthly_cap_micros", { mode: "number" })
    .notNull()
    .default(100_000_000),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  // First paid money in (top-up, auto-recharge or a converted subscription).
  fundedAt: timestamp("funded_at", { withTimezone: true }),
  // Set when the total balance crosses to <= 0, cleared when it is positive again.
  zeroBalanceAt: timestamp("zero_balance_at", { withTimezone: true }),
  // Notification dedup state, owned by lib/wallet/notify.ts.
  notified: jsonb("notified").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only money journal. Never purged (accounting retention): a closed
 * account's rows stay, with user_id set to NULL (VAT/OSS evidence, debts).
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    deltaMicros: bigint("delta_micros", { mode: "number" }).notNull(),
    bucket: text("bucket").$type<WalletBucket>().notNull(),
    kind: text("kind").$type<LedgerKind>().notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    // Total balance (paid + unexpired promo) right after this row.
    balanceAfterMicros: bigint("balance_after_micros", { mode: "number" }).notNull(),
    stripeRef: text("stripe_ref"),
    units: jsonb("units").$type<Record<string, unknown>>(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_ledger_user_created_idx").on(t.userId, t.createdAt.desc())]
);

/**
 * Last cumulative Upstash usage counters seen per box, so compute metering
 * debits only the difference. Written before every deleteBox (a deleted box
 * loses its counters).
 */
export const boxUsageSnapshots = pgTable("box_usage_snapshots", {
  boxId: text("box_id").primaryKey(),
  serverId: text("server_id"),
  userId: text("user_id"),
  totalCostUsd: numeric("total_cost_usd", { precision: 14, scale: 6 }).notNull().default("0"),
  totalCpuNs: bigint("total_cpu_ns", { mode: "number" }).notNull().default(0),
  sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One sign-up credit per normalized email (hashed), with an IP-prefix rate check. */
export const signupCreditClaims = pgTable(
  "signup_credit_claims",
  {
    emailHash: text("email_hash").primaryKey(),
    userId: text("user_id"),
    ipPrefix: text("ip_prefix"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("signup_credit_claims_ip_created_idx").on(t.ipPrefix, t.createdAt)]
);

export type WalletAccountRow = typeof walletAccounts.$inferSelect;
export type CreditLedgerRow = typeof creditLedger.$inferSelect;
export type BoxUsageSnapshotRow = typeof boxUsageSnapshots.$inferSelect;
