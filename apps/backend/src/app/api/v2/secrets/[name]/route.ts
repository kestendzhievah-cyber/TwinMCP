import { type NextRequest, NextResponse } from "next/server";
import { badRequest, jsonError, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { clientIp, logAudit } from "@/lib/audit/log";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { isConfigEncryptionReady } from "@/lib/crypto/config-encryption";
import { enqueue } from "@/lib/queue/qstash";
import { isValidSecretName } from "@/lib/vault/refs";
import { deleteSecret, findSecretUsage, getSecret, updateSecretValue } from "@/lib/vault/store";
import { secretJson, secretWriteRateLimited, updateSecretSchema } from "@/lib/vault/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

async function nameFrom(params: Params["params"]): Promise<string | null> {
  // Valid names are URL-safe ([A-Z0-9_]), so no decoding is needed.
  const { name } = await params;
  return isValidSecretName(name) ? name : null;
}

/** GET: one secret (never its value) and the MCPs that reference it. */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const name = await nameFrom(params);
  if (!name) return notFound("Secret not found");

  try {
    const secret = await getSecret(session.userId, name);
    if (!secret) return notFound("Secret not found");
    const usage = await findSecretUsage(session.userId);
    return NextResponse.json({ secret: secretJson(secret, usage.get(name) ?? []) });
  } catch (err) {
    console.error("[secrets/:name GET]", err);
    return serverError();
  }
}

/**
 * PATCH { value }: replace the value. Every enabled MCP that references the
 * secret is reconfigured (restarted with the new env) when its server runs;
 * on a stopped server it applies at the next start.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const name = await nameFrom(params);
  if (!name) return notFound("Secret not found");

  const rl = await checkAuthWriteLimit(session.userId, "secret_update");
  if (!rl.ok) return secretWriteRateLimited(rl.reset);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = updateSecretSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

  if (!isConfigEncryptionReady()) {
    return jsonError(503, "Secret storage is not configured on this server.");
  }

  try {
    const secret = await updateSecretValue(session.userId, name, parsed.data.value);
    if (!secret) return notFound("Secret not found");

    const usedBy = (await findSecretUsage(session.userId)).get(name) ?? [];
    const toRestart = usedBy.filter((u) => u.enabled);
    // Independent jobs; one failed enqueue must not hide the others.
    const results = await Promise.allSettled(
      toRestart.map((u) => enqueue({ type: "reconfigure-mcp", userServerId: u.userServerId }))
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[secrets PATCH] reconfigure ${toRestart[i].userServerId} enqueue failed:`,
          r.reason
        );
      }
    });

    const reconfigured = results.filter((r) => r.status === "fulfilled").length;
    // Name only: a secret's value never goes into the audit log.
    logAudit({
      userId: session.userId,
      action: "secret.update",
      targetType: "secret",
      targetId: secret.id,
      metadata: {
        name,
        usedByCount: usedBy.length,
        reconfigured,
        viaApiKey: session.apiKey ? true : undefined,
      },
      ip: clientIp(req),
    });

    return NextResponse.json({ secret: secretJson(secret, usedBy), reconfigured });
  } catch (err) {
    console.error("[secrets/:name PATCH]", err);
    return serverError();
  }
}

/**
 * DELETE: remove the secret. While an MCP still references it the answer is
 * 409 with `usedBy` (those MCPs would not start again); `?force=1` deletes
 * anyway. Running MCPs keep their current env until their next restart.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const name = await nameFrom(params);
  if (!name) return notFound("Secret not found");

  const rl = await checkAuthWriteLimit(session.userId, "secret_delete");
  if (!rl.ok) return secretWriteRateLimited(rl.reset);

  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const secret = await getSecret(session.userId, name);
    if (!secret) return notFound("Secret not found");

    const usedBy = (await findSecretUsage(session.userId)).get(name) ?? [];
    if (usedBy.length > 0 && !force) {
      return jsonError(
        409,
        `${name} is used by ${usedBy.length} MCP${usedBy.length > 1 ? "s" : ""}. They will not start again without it. Delete with ?force=1 to confirm.`,
        { code: "secret_in_use", usedBy }
      );
    }

    const deleted = await deleteSecret(session.userId, name);
    if (!deleted) return notFound("Secret not found");
    // Name only: a secret's value never goes into the audit log.
    logAudit({
      userId: session.userId,
      action: "secret.delete",
      targetType: "secret",
      targetId: secret.id,
      metadata: {
        name,
        usedByCount: usedBy.length,
        forced: force && usedBy.length > 0 ? true : undefined,
        viaApiKey: session.apiKey ? true : undefined,
      },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, usedBy });
  } catch (err) {
    console.error("[secrets/:name DELETE]", err);
    return serverError();
  }
}
