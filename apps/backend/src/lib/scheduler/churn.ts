// Churn alerts, as /api/cron/churn sends them: at-risk clients not alerted in
// the last 7 days (dedup through the admin.churn.alert audit rows), one email
// to the admin, then one audit row per alerted client. /api/cron/churn and
// the scheduler both call this function.

import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { computeClientHealth, atRiskClients } from "@/lib/admin/health";
import { sendAdminDigest } from "@/lib/email";
import { logAudit } from "@/lib/audit/log";

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

export async function runChurnAlerts(to: string): Promise<{ alerted: number; atRisk: number }> {
  const atRisk = atRiskClients(await computeClientHealth());
  if (atRisk.length === 0) return { alerted: 0, atRisk: 0 };

  const ids = atRisk.map((c) => c.userId);
  const recent = await getDb()
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
  if (fresh.length === 0) return { alerted: 0, atRisk: atRisk.length };

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
  return { alerted: fresh.length, atRisk: atRisk.length };
}
