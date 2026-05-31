// Grant complimentary plan access to a user (e.g. influencers, partners, OSS
// maintainers). Bypasses Stripe entirely: no customer, no invoice, no webhook.
//
// Usage:
//   pnpm tsx scripts/grant-comp-access.ts --email someone@example.com --plan pro --note "yt-collab"
//   pnpm tsx scripts/grant-comp-access.ts --email someone@example.com --plan pro --note "yt-collab" --revoke
//
// Reversal: pass --revoke to drop the user back to free and clear the comp flag.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "../src/db/schema";

type Args = { email?: string; plan?: "pro" | "team"; note?: string; revoke: boolean };

function parseArgs(argv: string[]): Args {
  const out: Args = { revoke: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--plan") out.plan = argv[++i] as Args["plan"];
    else if (a === "--note") out.note = argv[++i];
    else if (a === "--revoke") out.revoke = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.email) {
  console.error("missing --email");
  process.exit(1);
}
if (!args.revoke && (!args.plan || (args.plan !== "pro" && args.plan !== "team"))) {
  console.error("missing or invalid --plan (pro|team)");
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL or DATABASE_URL_UNPOOLED required");
  process.exit(1);
}

const client = postgres(url, { max: 1, ssl: "require" });
const db = drizzle(client, { schema });

async function main() {
  const [user] = await db
    .select({ id: schema.users.id, email: schema.users.email, plan: schema.users.plan, metadata: schema.users.metadata })
    .from(schema.users)
    .where(eq(schema.users.email, args.email!))
    .limit(1);

  if (!user) {
    console.error(`no user with email ${args.email}`);
    process.exit(1);
  }

  if (args.revoke) {
    const md = { ...(user.metadata ?? {}) } as Record<string, unknown>;
    delete md.comp;
    await db
      .update(schema.users)
      .set({ plan: "free", metadata: md, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: user.id,
      action: "plan.downgrade",
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "comp_revoked", previousPlan: user.plan },
    });
    console.log(`✓ revoked comp access for ${user.email} (was ${user.plan})`);
    return;
  }

  const comp = {
    grantedAt: new Date().toISOString(),
    grantedBy: process.env.USER ?? process.env.USERNAME ?? "cli",
    plan: args.plan,
    note: args.note ?? null,
  };
  const md = { ...(user.metadata ?? {}), comp } as Record<string, unknown>;

  await db
    .update(schema.users)
    .set({ plan: args.plan, metadata: md, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: user.id,
    action: "plan.upgrade",
    targetType: "user",
    targetId: user.id,
    metadata: { reason: "comp_granted", from: user.plan, to: args.plan, note: args.note ?? null },
  });

  console.log(`✓ granted ${args.plan} (comp) to ${user.email}`);
  console.log(`  was: ${user.plan}`);
  console.log(`  note: ${args.note ?? "(none)"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
