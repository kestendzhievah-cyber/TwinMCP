// Create a Stripe coupon + a human-readable promotion code, scoped to the
// Pro monthly price. Default: 100% off for the first month, then full price
// renews unless the user cancels.
//
// Usage:
//   pnpm tsx scripts/create-promo-code.ts --code YT-NOM-1MOIS --maxRedemptions 500 --expiresInDays 30
//   pnpm tsx scripts/create-promo-code.ts --code YT-NOM-1MOIS --plan pro --cadence monthly --months 1
//
// Output: copy the printed `promo_xxx` id into apps/backend/src/lib/promos/creators.ts.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import Stripe from "stripe";

type Args = {
  code?: string;
  plan: "pro" | "team";
  cadence: "monthly" | "yearly";
  months: number;
  maxRedemptions?: number;
  expiresInDays?: number;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { plan: "pro", cadence: "monthly", months: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--code") out.code = argv[++i];
    else if (a === "--plan") out.plan = argv[++i] as Args["plan"];
    else if (a === "--cadence") out.cadence = argv[++i] as Args["cadence"];
    else if (a === "--months") out.months = Number(argv[++i]);
    else if (a === "--maxRedemptions") out.maxRedemptions = Number(argv[++i]);
    else if (a === "--expiresInDays") out.expiresInDays = Number(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.code) {
  console.error("missing --code (e.g. YT-NOM-1MOIS)");
  process.exit(1);
}

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}

const priceEnv =
  args.plan === "pro"
    ? args.cadence === "monthly"
      ? "STRIPE_PRO_MONTHLY_PRICE_ID"
      : "STRIPE_PRO_YEARLY_PRICE_ID"
    : args.cadence === "monthly"
      ? "STRIPE_TEAM_MONTHLY_PRICE_ID"
      : "STRIPE_TEAM_YEARLY_PRICE_ID";

const priceId = process.env[priceEnv];
if (!priceId) {
  console.error(`${priceEnv} not set — needed to scope the coupon to a specific price`);
  process.exit(1);
}

const stripe = new Stripe(secret, { apiVersion: "2026-03-25.dahlia" });

async function main() {
  // Resolve the Product behind the Price so we can scope `applies_to.products`.
  // Coupon `applies_to` works at the Product level, not the Price level.
  const price = await stripe.prices.retrieve(priceId!);
  const productId = typeof price.product === "string" ? price.product : price.product.id;

  const coupon = await stripe.coupons.create({
    name: `${args.code} — ${args.months} month${args.months > 1 ? "s" : ""} free (${args.plan})`,
    percent_off: 100,
    duration: args.months === 1 ? "once" : "repeating",
    ...(args.months > 1 ? { duration_in_months: args.months } : {}),
    applies_to: { products: [productId] },
    metadata: { source: "create-promo-code.ts", plan: args.plan, cadence: args.cadence },
  });

  // dahlia (2026-03): promotion code now wraps the coupon in a `promotion`
  // object so future promotion types (gift cards, etc.) can plug in without
  // breaking the request shape.
  const promotionCode = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: args.code!,
    ...(args.maxRedemptions ? { max_redemptions: args.maxRedemptions } : {}),
    ...(args.expiresInDays
      ? { expires_at: Math.floor(Date.now() / 1000) + args.expiresInDays * 86400 }
      : {}),
    metadata: { source: "create-promo-code.ts" },
  });

  console.log("✓ created Stripe coupon + promotion code");
  console.log("");
  console.log("  coupon.id          ", coupon.id);
  console.log("  promotion_code.id  ", promotionCode.id, "   ← put this in creators.ts");
  console.log("  human code         ", promotionCode.code, "   ← share this with users");
  console.log("  scope              ", `${args.plan} ${args.cadence}`);
  console.log("  free months        ", args.months);
  console.log("  max redemptions    ", args.maxRedemptions ?? "∞");
  console.log(
    "  expires at         ",
    args.expiresInDays
      ? new Date(Date.now() + args.expiresInDays * 86400_000).toISOString()
      : "never"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
