import { type NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { computeClientHealth, atRiskClients } from "@/lib/admin/health";
import { sendAdminDigest } from "@/lib/email";
import { adminEmails } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { logAudit } from "@/lib/audit/log";
import { serverError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const DAY = 86_400_000;

const HEALTH_FR: Record<string, string> = {
  critical: "Critique",
  at_risk: "À risque",
  inactive: "Inactif",
  new: "Nouveau",
  healthy: "OK",
};

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Same dual auth as the digest: Bearer CRON_SECRET (scheduled) or an admin
// session (manual test).
async function authorize(req: NextRequest): Promise<null | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return null;
  const admin = await requireAdmin(req);
  return admin instanceof NextResponse ? admin : null;
}

async function run(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  try {
    const atRisk = atRiskClients(await computeClientHealth());
    if (atRisk.length === 0) return NextResponse.json({ alerted: 0, atRisk: 0 });

    const db = getDb();
    const ids = atRisk.map((c) => c.userId);

    // Dedup: skip clients already alerted in the last 7 days (via the audit log,
    // no extra table).
    const recent = await db
      .select({ userId: auditLogs.userId })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "admin.churn.alert"),
          gte(auditLogs.createdAt, new Date(Date.now() - 7 * DAY)),
          inArray(auditLogs.userId, ids)
        )
      );
    const alreadyAlerted = new Set(recent.map((r) => r.userId));
    const fresh = atRisk.filter((c) => !alreadyAlerted.has(c.userId));
    if (fresh.length === 0) return NextResponse.json({ alerted: 0, atRisk: atRisk.length });

    const to = process.env.DIGEST_EMAIL ?? adminEmails()[0];
    if (to) {
      const rows = fresh
        .map(
          (c) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #eee"><strong>${esc(c.email)}</strong> <span style="color:#888">· ${esc(HEALTH_FR[c.status] ?? c.status)} — ${esc(c.reason)}</span></td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right"><a href="${SITE}/dashboard/admin/clients/${c.userId}" style="color:#2563eb">voir</a></td></tr>`
        )
        .join("");
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
        <p style="font-size:16px"><strong>${fresh.length} client(s) à risque</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
        <p style="margin:24px 0 0"><a href="${SITE}/dashboard/admin/cockpit" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Ouvrir le cockpit</a></p>
      </div>`;
      await sendAdminDigest(to, `TwinMCP · ${fresh.length} client(s) à risque`, html);
    }

    // Record the alert so we don't re-notify the same client within 7 days.
    for (const c of fresh) {
      logAudit({
        userId: c.userId,
        action: "admin.churn.alert",
        targetType: "user",
        targetId: c.userId,
        metadata: { status: c.status, reason: c.reason },
        ip: null,
      });
    }

    return NextResponse.json({ alerted: fresh.length, atRisk: atRisk.length, sentTo: to ?? null });
  } catch (err) {
    console.error("[churn]", err);
    return serverError("Échec de la détection churn.");
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
