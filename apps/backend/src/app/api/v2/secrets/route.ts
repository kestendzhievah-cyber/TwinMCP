import { type NextRequest, NextResponse } from "next/server";
import { badRequest, jsonError, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { clientIp, logAudit } from "@/lib/audit/log";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { isConfigEncryptionReady } from "@/lib/crypto/config-encryption";
import {
  createSecret,
  findSecretUsage,
  listSecrets,
  MAX_SECRETS_PER_USER,
} from "@/lib/vault/store";
import {
  createSecretSchema,
  danglingRefs,
  secretJson,
  secretWriteRateLimited,
} from "@/lib/vault/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Secrets vault (contract D6). Names, timestamps and "used by" only: a value
// goes in through POST / PATCH and never comes back out of the API.

/** GET: every secret of the account with where it is used, plus references to missing ones. */
export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const [secrets, usage] = await Promise.all([
      listSecrets(session.userId),
      findSecretUsage(session.userId),
    ]);
    const stored = new Set(secrets.map((s) => s.name));
    return NextResponse.json({
      secrets: secrets.map((s) => secretJson(s, usage.get(s.name) ?? [])),
      missing: danglingRefs(usage, stored),
      limit: MAX_SECRETS_PER_USER,
    });
  } catch (err) {
    console.error("[secrets GET]", err);
    return serverError();
  }
}

/** POST { name, value }: store a new secret. 409 when the name is taken. */
export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  const rl = await checkAuthWriteLimit(session.userId, "secret_create");
  if (!rl.ok) return secretWriteRateLimited(rl.reset);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createSecretSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

  if (!isConfigEncryptionReady()) {
    return jsonError(503, "Secret storage is not configured on this server.");
  }

  try {
    const result = await createSecret(session.userId, parsed.data.name, parsed.data.value);
    if (!result.ok) {
      if (result.reason === "exists") {
        return jsonError(409, `A secret named ${parsed.data.name} already exists.`, {
          code: "secret_exists",
        });
      }
      return jsonError(
        403,
        `You can store up to ${MAX_SECRETS_PER_USER} secrets. Delete one you no longer use.`,
        { code: "secret_limit" }
      );
    }
    // Name only: a secret's value never goes into the audit log.
    logAudit({
      userId: session.userId,
      action: "secret.create",
      targetType: "secret",
      targetId: result.secret.id,
      metadata: { name: result.secret.name, viaApiKey: session.apiKey ? true : undefined },
      ip: clientIp(req),
    });
    return NextResponse.json({ secret: secretJson(result.secret) }, { status: 201 });
  } catch (err) {
    console.error("[secrets POST]", err);
    return serverError();
  }
}
