/**
 * One-off backfill: give the sign-up credit (PRICING.signupCreditEur, valid
 * PRICING.signupCreditDays) to accounts created before the wallet existed, so
 * existing free users are not stuck at €0 after the switch to pay-as-you-go.
 *
 * Eligible: every user that is not funded (no wallet funded_at and no live
 * paying legacy subscription; those go through migrate-pro-to-wallet.ts) and
 * holds no sign-up credit claim yet. Reuses grantSignupCredit, so the grant
 * is idempotent (same ledger key as a normal sign-up) and safe to re-run.
 * Existing accounts are treated as verified and are not subject to the
 * per-IP sign-up limits (they have no sign-up IP). No e-mail is sent.
 *
 * DRY-RUN by default. Usage (from apps/backend):
 *   npx tsx scripts/grant-existing-signup-credit.ts           # list only
 *   npx tsx scripts/grant-existing-signup-credit.ts --apply   # grant
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const apply = process.argv.includes("--apply");

const { getDb } = await import("../src/db");
const { users } = await import("../src/db/schema");
const { walletAccounts, signupCreditClaims } = await import("../src/db/schema/wallet");
const { eq } = await import("drizzle-orm");
const { grantSignupCredit, signupIpLimits } = await import("../src/lib/wallet/signup-credit");
const { isFundedAccount } = await import("../src/lib/plan-features");

const db = getDb();
const rows = await db
  .select({
    id: users.id,
    email: users.email,
    subscriptionStatus: users.subscriptionStatus,
    fundedAt: walletAccounts.fundedAt,
    claimedBy: signupCreditClaims.userId,
  })
  .from(users)
  .leftJoin(walletAccounts, eq(walletAccounts.userId, users.id))
  .leftJoin(signupCreditClaims, eq(signupCreditClaims.userId, users.id));

const eligible = rows.filter(
  (r) => !isFundedAccount(r.fundedAt ?? null, r.subscriptionStatus ?? null) && !r.claimedBy
);
const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

console.log(`${rows.length} users, ${eligible.length} eligible for the sign-up credit.`);
for (const r of eligible) console.log(`  - ${r.id}  ${mask(r.email)}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to grant.");
  process.exit(0);
}

const limits = {
  ...signupIpLimits(),
  perIpPerDay: 1_000_000,
  perSubnetPerDay: 1_000_000,
  perDay: 1_000_000,
};
let granted = 0;
for (const r of eligible) {
  const res = await grantSignupCredit(
    { userId: r.id, email: r.email, ip: null, emailVerified: true },
    { limits }
  );
  console.log(`  ${mask(r.email)}: ${res.granted ? "granted" : `skipped (${res.reason})`}`);
  if (res.granted) granted += 1;
}
console.log(`\nGranted ${granted} of ${eligible.length}.`);
process.exit(0);
