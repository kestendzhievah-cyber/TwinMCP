import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, servers, mcpServers, userServers } from "@/db/schema";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { logAudit } from "@/lib/audit/log";
import { getBundle } from "@/lib/mcp-bundles";
import { configSchemaShape, validateConfigAgainstSchema } from "@/lib/validation/platform";

// Deployed automatically when a prospect is marked "won" (see the prospects
// PATCH route). Starter setup = one small box + the zero-config "Essentiel" pack.
const DEFAULT_BUNDLE = "essentiel";

export type OnboardResult =
  | { onboarded: true; serverId: string; installed: string[] }
  | { onboarded: false; reason: "no_account" | "already_provisioned" | "error" };

export async function autoOnboardWonProspect(opts: {
  email: string | null;
  adminUserId: string;
}): Promise<OnboardResult> {
  const email = opts.email?.trim().toLowerCase();
  if (!email) return { onboarded: false, reason: "no_account" };

  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (!user) return { onboarded: false, reason: "no_account" };

  // Don't double-provision — if they already have a live server, leave it.
  const [existing] = await db
    .select({ id: servers.id })
    .from(servers)
    .where(and(eq(servers.userId, user.id), ne(servers.status, "destroyed")))
    .limit(1);
  if (existing) return { onboarded: false, reason: "already_provisioned" };

  try {
    const serverId = randomUUID();
    await db.insert(servers).values({
      id: serverId,
      userId: user.id,
      name: "Production",
      slug: "production",
      hostType: "upstash_box",
      boxSize: "small",
      status: "provisioning",
    });

    // twinmcp-docs (control-plane proxy), best-effort like the self-serve flow.
    const [docs] = await db
      .select({ id: mcpServers.id })
      .from(mcpServers)
      .where(eq(mcpServers.slug, TWINMCP_DOCS_SLUG))
      .limit(1);
    if (docs) {
      try {
        const e = encryptConfig({});
        await db.insert(userServers).values({
          id: randomUUID(),
          userId: user.id,
          serverId,
          mcpServerId: docs.id,
          configCiphertext: e.ciphertext,
          configIv: e.iv,
          configTag: e.tag,
          enabled: true,
        });
      } catch {
        /* best-effort */
      }
    }

    // Default pack — all zero-config, so each validates against an empty config.
    const installed: string[] = [];
    const bundle = getBundle(DEFAULT_BUNDLE);
    if (bundle) {
      const catalog = await db
        .select()
        .from(mcpServers)
        .where(inArray(mcpServers.slug, bundle.slugs));
      for (const mcp of catalog) {
        if (!mcp.isPublic || mcp.hostMode !== "box") continue;
        const sp = configSchemaShape.safeParse(mcp.configSchema);
        if (!sp.success || !validateConfigAgainstSchema({}, sp.data).ok) continue;
        const e = encryptConfig({});
        const usId = randomUUID();
        try {
          await db.insert(userServers).values({
            id: usId,
            userId: user.id,
            serverId,
            mcpServerId: mcp.id,
            configCiphertext: e.ciphertext,
            configIv: e.iv,
            configTag: e.tag,
            enabled: true,
          });
        } catch {
          continue;
        }
        await enqueue({ type: "install-mcp", userServerId: usId }).catch(() => {});
        installed.push(mcp.slug);
      }
    }

    await enqueue({ type: "provision-server", serverId }).catch(() => {});
    logAudit({
      userId: user.id,
      action: "admin.server.create",
      targetType: "server",
      targetId: serverId,
      metadata: { auto: "won-onboarding", bundle: DEFAULT_BUNDLE, actorAdminId: opts.adminUserId },
      ip: null,
    });

    return { onboarded: true, serverId, installed };
  } catch (err) {
    console.error("[auto onboard]", err);
    return { onboarded: false, reason: "error" };
  }
}
