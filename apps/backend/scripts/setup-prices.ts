// Idempotently create the billable products + their monthly/yearly recurring
// prices in Stripe, then print the price IDs to paste into your env (Dokploy for
// prod). Safe to re-run: it reuses an existing product/price (matched by
// metadata + amount) instead of duplicating.
//
//   Pro    €14.99 / month   ·  €135 / year
//   Team   €99    / month   ·  €990 / year   (self-serve; Enterprise stays contact)
//
// The Stripe MODE is decided by STRIPE_SECRET_KEY:
//   TEST:  cd apps/backend && pnpm tsx scripts/setup-prices.ts        (reads .env.local)
//   LIVE:  cd apps/backend && STRIPE_SECRET_KEY=sk_live_xxx pnpm tsx scripts/setup-prices.ts
//
// After running with a LIVE key, put the printed price IDs (and your live
// STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) into Dokploy, then redeploy.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import Stripe from "stripe";

const CURRENCY = "eur";
// SaaS (business use) tax code so Stripe Tax / automatic_tax has a category.
const TAX_CODE = "txcd_10103001";

interface PlanSpec {
  key: "PRO" | "TEAM"; // env prefix: STRIPE_<key>_MONTHLY/YEARLY_PRICE_ID
  name: string;
  marker: string; // product metadata marker for idempotent lookup
  description: string;
  monthly: number; // cents
  yearly: number; // cents
}

const PLANS: PlanSpec[] = [
  {
    key: "PRO",
    name: "TwinMCP Pro",
    marker: "twinmcp-pro",
    description:
      "TwinMCP Pro — 25 servers, publish your own MCPs, audit logs (30 days), priority support.",
    monthly: 1499, // €14.99
    yearly: 13500, // €135
  },
  {
    key: "TEAM",
    name: "TwinMCP Team",
    marker: "twinmcp-team",
    description:
      "TwinMCP Team — unlimited servers, member management, audit logs (90 days), 99.9% SLA.",
    monthly: 9900, // €99
    yearly: 99000, // €990
  },
];

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY not set (put it in .env.local, or prefix the command).");
  process.exit(1);
}
const isLive = secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
const stripe = new Stripe(secret, { apiVersion: "2026-03-25.dahlia" });

async function findOrCreateProduct(spec: PlanSpec): Promise<Stripe.Product> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((p) => p.metadata?.twinmcp === spec.marker);
  if (existing) {
    console.log(`• reusing product ${existing.id} (${existing.name})`);
    return existing;
  }
  const created = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    tax_code: TAX_CODE,
    metadata: { twinmcp: spec.marker },
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
    metadata: { twinmcp: `${interval}` },
  });
  console.log(`• created ${label} → ${created.id}`);
  return created;
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

async function main() {
  console.log(`Stripe mode: ${isLive ? "LIVE 🔴" : "TEST"}  (key ${secret!.slice(0, 8)}…)\n`);
  const envLines: string[] = [];

  for (const spec of PLANS) {
    console.log(`${spec.name}:`);
    const product = await findOrCreateProduct(spec);
    const monthly = await findOrCreatePrice(
      product.id,
      spec.monthly,
      "month",
      `monthly ${eur(spec.monthly)}/mo`
    );
    const yearly = await findOrCreatePrice(
      product.id,
      spec.yearly,
      "year",
      `yearly ${eur(spec.yearly)}/yr`
    );
    envLines.push(`STRIPE_${spec.key}_MONTHLY_PRICE_ID=${monthly.id}`);
    envLines.push(`STRIPE_${spec.key}_YEARLY_PRICE_ID=${yearly.id}`);
    console.log("");
  }

  console.log(`=== copy these into your env (${isLive ? "Dokploy / prod" : ".env.local"}) ===`);
  console.log(envLines.join("\n"));
  console.log(
    isLive
      ? "\n⚠️  LIVE prices — real customers will be charged these amounts. Also set the\n    live STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Dokploy, then redeploy."
      : "\n(TEST mode — for production, re-run this with a LIVE key: STRIPE_SECRET_KEY=sk_live_…)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
