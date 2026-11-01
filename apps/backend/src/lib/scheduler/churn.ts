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
import { cardEmail, esc, link, p, row, table } from "@/lib/email-layout";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const DAY = 86_400_000;

const HEALTH_FR: Record<string, string> = {
  critical: "Critique",
  at_risk: "À risque",
  inactive: "Inactif",
  new: "Nouveau",
  healthy: "OK",
};

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

  // Clear sky email chrome (lib/email-layout.ts): one row per client, the
  // status and reason muted, a "voir" link, and the cockpit as the one button.
  const rows = fresh.map((c) =>
    row(
      `${esc(HEALTH_FR[c.status] ?? c.status)}`,
      `<strong>${esc(c.email)}</strong> · ${esc(c.reason)} · ${link(
        `${SITE}/dashboard/admin/clients/${c.userId}`,
        "voir"
      )}`
    )
  );
  const html = cardEmail({
    eyebrow: "Admin",
    title: `${fresh.length} client(s) à risque`,
    body: p("Clients à risque non signalés ces 7 derniers jours.") + table(rows),
    cta: { label: "Ouvrir le cockpit", href: `${SITE}/dashboard/admin/cockpit` },
  });
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
