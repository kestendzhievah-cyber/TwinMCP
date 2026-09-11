import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, mcpServers, userServers } from "@/db/schema";
import { badRequest, notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { configSchemaShape, validateConfigAgainstSchema } from "@/lib/validation/platform";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";
import { logAudit, clientIp } from "@/lib/audit/log";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { getBundle } from "@/lib/mcp-bundles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deploy a curated pack of MCPs onto a client's box. Each slug is installed with
// an empty config; anything that can't auto-install (missing, non-public, local,
// already installed, box full, or needs required config) is skipped with a
// reason so a pack never half-fails.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serverId: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id: clientId, serverId } = await params;
  const db = getDb();

  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server || server.userId !== clientId) return notFound("Serveur introuvable pour ce client");
  if (server.hostType === "local_agent") {
    return badRequest("Les packs ciblent les serveurs box, pas les serveurs local-agent.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const bundleId = (body as { bundleId?: string })?.bundleId ?? "";
  const bundle = getBundle(bundleId);
  if (!bundle) return badRequest("Pack inconnu.");

  try {
    const cap = maxMcpsForBoxSize(server.boxSize);

    const [tally] = await db
      .select({ n: count() })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(
        and(
          eq(userServers.serverId, serverId),
          eq(userServers.enabled, true),
          ne(mcpServers.slug, TWINMCP_DOCS_SLUG)
        )
      );
    let used = tally?.n ?? 0;

    const existing = await db
      .select({ slug: mcpServers.slug })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(eq(userServers.serverId, serverId));
    const installedSlugs = new Set(existing.map((r) => r.slug));

    const catalog = await db
      .select()
      .from(mcpServers)
      .where(inArray(mcpServers.slug, bundle.slugs));
    const bySlug = new Map(catalog.map((m) => [m.slug, m]));

    const installed: string[] = [];
    const skipped: { slug: string; reason: string }[] = [];

    for (const slug of bundle.slugs) {
      const mcp = bySlug.get(slug);
      if (!mcp || !mcp.isPublic) {
        skipped.push({ slug, reason: "indisponible" });
        continue;
      }
      if (mcp.hostMode !== "box") {
        skipped.push({ slug, reason: "local (non applicable)" });
        continue;
      }
      if (installedSlugs.has(slug)) {
        skipped.push({ slug, reason: "déjà installé" });
        continue;
      }
      if (used >= cap) {
        skipped.push({ slug, reason: "capacité box atteinte" });
        continue;
      }
      const sp = configSchemaShape.safeParse(mcp.configSchema);
      if (!sp.success) {
        skipped.push({ slug, reason: "catalogue malformé" });
        continue;
      }
      if (!validateConfigAgainstSchema({}, sp.data).ok) {
        skipped.push({ slug, reason: "nécessite une configuration" });
        continue;
      }

      const encrypted = encryptConfig({});
      const id = randomUUID();
      try {
        await db.insert(userServers).values({
          id,
          userId: clientId,
          serverId,
          mcpServerId: mcp.id,
          configCiphertext: encrypted.ciphertext,
          configIv: encrypted.iv,
          configTag: encrypted.tag,
          enabled: true,
        });
      } catch (e) {
        if (e instanceof Error && /unique/i.test(e.message)) {
          skipped.push({ slug, reason: "déjà installé" });
          continue;
        }
        throw e;
      }

      logAudit({
        userId: clientId,
        action: "admin.mcp.install",
        targetType: "user_server",
        targetId: id,
        metadata: {
          serverId,
          mcpServerId: mcp.id,
          slug,
          bundle: bundle.id,
          actorAdminId: admin.userId,
        },
        ip: clientIp(req),
      });
      await enqueue({ type: "install-mcp", userServerId: id }).catch((err) =>
        console.error(`[admin bundle] enqueue install ${id} failed:`, err)
      );

      installed.push(slug);
      installedSlugs.add(slug);
      used++;
    }

    return NextResponse.json({ installed, skipped });
  } catch (err) {
    console.error("[admin bundle install]", err);
    return serverError();
  }
}
