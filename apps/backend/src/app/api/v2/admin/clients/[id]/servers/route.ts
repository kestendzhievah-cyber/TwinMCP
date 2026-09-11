import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, users, mcpServers, userServers } from "@/db/schema";
import { badRequest, notFound, serverError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { createServerSchema, slugify } from "@/lib/validation/platform";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { encryptConfig } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin provisions a cloud box ON BEHALF OF a client (white-glove B2B onboarding).
// Box only — local_agent needs the client's own machine. No self-serve quota /
// plan gating here: the founder decides. Every action is audited with the
// acting admin's id under the client's audit trail.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id: clientId } = await params;
  const db = getDb();

  const [client] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  if (!client) return notFound("Client introuvable");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const boxSize = parsed.data.boxSize ?? "small";
  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  if (!slug) return badRequest("Nom invalide (impossible d'en dériver un slug).");

  const id = randomUUID();
  try {
    await db.insert(servers).values({
      id,
      userId: clientId,
      name: parsed.data.name,
      slug,
      hostType: "upstash_box",
      boxSize,
      region: parsed.data.region ?? null,
      status: "provisioning",
    });

    // Auto-install twinmcp-docs (control-plane proxy), same as the self-serve
    // flow. Best-effort — a missing key must not block creation.
    const [docsMcp] = await db
      .select({ id: mcpServers.id })
      .from(mcpServers)
      .where(eq(mcpServers.slug, TWINMCP_DOCS_SLUG))
      .limit(1);
    if (docsMcp) {
      try {
        const empty = encryptConfig({});
        await db.insert(userServers).values({
          id: randomUUID(),
          userId: clientId,
          serverId: id,
          mcpServerId: docsMcp.id,
          configCiphertext: empty.ciphertext,
          configIv: empty.iv,
          configTag: empty.tag,
          enabled: true,
        });
      } catch {
        /* best-effort */
      }
    }

    logAudit({
      userId: clientId,
      action: "admin.server.create",
      targetType: "server",
      targetId: id,
      metadata: { slug, boxSize, actorAdminId: admin.userId },
      ip: clientIp(req),
    });

    await enqueue({ type: "provision-server", serverId: id }).catch((err) =>
      console.error(`[admin server create] enqueue provision ${id} failed:`, err)
    );

    return NextResponse.json({ id, slug, status: "provisioning" }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      return badRequest("Ce client a déjà un serveur portant ce nom.");
    }
    console.error("[admin server create]", err);
    return serverError();
  }
}
