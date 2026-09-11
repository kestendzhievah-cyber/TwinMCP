import { type NextRequest, NextResponse } from "next/server";
import { computeAttention } from "@/lib/admin/attention";
import { buildDigestEmail } from "@/lib/admin/digest-email";
import { sendAdminDigest } from "@/lib/email";
import { adminEmails } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { serverError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Two callers:
//  - scheduled (QStash schedule / cron): Authorization: Bearer <CRON_SECRET>.
//  - manual "send me now" from the cockpit: an admin session.
async function authorize(req: NextRequest): Promise<null | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return null; // scheduled path
  const admin = await requireAdmin(req); // manual path → 401/403 if not admin
  return admin instanceof NextResponse ? admin : null;
}

async function run(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  const to = process.env.DIGEST_EMAIL ?? adminEmails()[0];
  if (!to) return serverError("Aucun destinataire (DIGEST_EMAIL ou ADMIN_EMAILS).");

  try {
    const data = await computeAttention();
    const { subject, html } = buildDigestEmail(data);
    await sendAdminDigest(to, subject, html);
    return NextResponse.json({ ok: true, sentTo: to, total: data.counts.total });
  } catch (err) {
    console.error("[digest]", err);
    return serverError("Échec de l'envoi (RESEND_API_KEY configuré ?).");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
