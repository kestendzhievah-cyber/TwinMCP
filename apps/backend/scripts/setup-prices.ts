// Idempotently create the TwinMCP Pro product + its two recurring prices
// (€14.99/month and €135/year) in Stripe, then print the price IDs to paste
// into your env (Dokploy for prod). Safe to re-run: it reuses an existing
// product/price (matched by metadata + amount) instead of duplicating.
//
// The Stripe MODE is decided by STRIPE_SECRET_KEY:
//   TEST:  cd apps/backend && pnpm tsx scripts/setup-prices.ts        (reads .env.local)
//   LIVE:  cd apps/backend && STRIPE_SECRET_KEY=sk_live_xxx pnpm tsx scripts/setup-prices.ts
//
// After running with a LIVE key, put the two printed price IDs (and your live
// STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) into Dokploy, then redeploy.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import Stripe from "stripe";

const CURRENCY = "eur";
const MONTHLY_AMOUNT = 1499; // €14.99 / month
const YEARLY_AMOUNT = 13500; // €135.00 / year
const PRODUCT_NAME = "TwinMCP Pro";
const PRODUCT_MARKER = "twinmcp-pro"; // metadata marker so re-runs are idempotent
// SaaS (business use) tax code so Stripe Tax / automatic_tax has a category.
const TAX_CODE = "txcd_10103001";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY not set (put it in .env.local, or prefix the command).");
  process.exit(1);
}
const isLive = secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
const stripe = new Stripe(secret, { apiVersion: "2026-03-25.dahlia" });

async function findOrCreateProduct(): Promise<Stripe.Product> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((p) => p.metadata?.twinmcp === PRODUCT_MARKER);
  if (existing) {
    console.log(`• reusing product ${existing.id} (${existing.name})`);
    return existing;
  }
  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    description:
      "TwinMCP Pro — 25 servers, publish your own MCPs, audit logs (30 days), priority support.",
    tax_code: TAX_CODE,
    metadata: { twinmcp: PRODUCT_MARKER },
  });
  console.log(`• created product ${created.id} (${created.name})`);
  return created;
}

async function findOrCreatePrice(
  productId: string,
  amount: number,
  interval: "month" | "year",
  label: string
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const existing = prices.data.find(
    (p) => p.unit_amount === amount && p.currency === CURRENCY && p.recurring?.interval === interval
  );
  if (existing) {
    console.log(`• reusing ${label} → ${existing.id}`);
    return existing;
  }
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: CURRENCY,
    recurring: { interval },
    metadata: { twinmcp: `pro-${interval}` },
  });
  console.log(`• created ${label} → ${created.id}`);
  return created;
}

async function main() {
  console.log(`Stripe mode: ${isLive ? "LIVE 🔴" : "TEST"}  (key ${secret!.slice(0, 8)}…)\n`);
  const product = await findOrCreateProduct();
  const monthly = await findOrCreatePrice(product.id, MONTHLY_AMOUNT, "month", "monthly €14.99/mo");
  const yearly = await findOrCreatePrice(product.id, YEARLY_AMOUNT, "year", "yearly €135/yr");

  console.log(`\n=== copy these into your env (${isLive ? "Dokploy / prod" : ".env.local"}) ===`);
  console.log(`STRIPE_PRO_MONTHLY_PRICE_ID=${monthly.id}`);
  console.log(`STRIPE_PRO_YEARLY_PRICE_ID=${yearly.id}`);
  console.log(
    isLive
      ? "\n⚠️  LIVE prices — real customers will be charged €14.99/mo or €135/yr. Also set the\n    live STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Dokploy, then redeploy."
      : "\n(TEST mode — for production, re-run this with a LIVE key: STRIPE_SECRET_KEY=sk_live_…)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
