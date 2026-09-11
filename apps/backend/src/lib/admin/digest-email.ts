import type { AttentionData } from "./attention";

// Builds the daily digest email (subject + HTML) from the shared attention data.
// Plain inline-styled HTML — email clients don't do external CSS.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function buildDigestEmail(data: AttentionData): { subject: string; html: string } {
  const {
    followUpsDue,
    newLeads,
    serversInError,
    stuckProvisioning,
    newSignups,
    clientsAtRisk,
    counts,
  } = data;
  const actionable = counts.total + clientsAtRisk.length;

  const subject =
    actionable === 0
      ? "TwinMCP · Rien à traiter aujourd'hui 🎉"
      : `TwinMCP · Votre journée — ${actionable} à traiter`;

  const HEALTH_FR: Record<string, string> = {
    critical: "Critique",
    at_risk: "À risque",
    inactive: "Inactif",
    new: "Nouveau",
    healthy: "OK",
  };

  const row = (left: string, right: string): string =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${left}</td>` +
    `<td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#666;white-space:nowrap">${right}</td></tr>`;

  const section = (title: string, rows: string[]): string =>
    rows.length === 0
      ? ""
      : `<h2 style="font-size:15px;margin:24px 0 8px;color:#111">${esc(title)}</h2>` +
        `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.join("")}</table>`;

  const clientLink = (userId: string) =>
    `<a href="${SITE}/dashboard/admin/clients/${userId}" style="color:#2563eb">voir</a>`;

  const relances = section(
    "🔔 Relances du jour",
    followUpsDue.map((p) =>
      row(
        `<strong>${esc(p.company)}</strong>${p.contactName ? " · " + esc(p.contactName) : ""}` +
          (p.email || p.phone
            ? `<br><span style="color:#888;font-size:12px">${esc([p.email, p.phone].filter(Boolean).join(" · "))}</span>`
            : ""),
        fmtDate(p.nextActionAt)
      )
    )
  );

  const leads = section(
    "✨ Nouveaux leads (24 h)",
    newLeads.map((p) =>
      row(
        `<strong>${esc(p.company)}</strong>${p.source ? ` <span style="color:#888">· ${esc(p.source)}</span>` : ""}`,
        fmtDate(p.createdAt)
      )
    )
  );

  const errors = section(
    "⚠️ Serveurs en erreur",
    serversInError.map((s) =>
      row(
        `<strong>${esc(s.name)}</strong> <span style="color:#888">· ${esc(s.email)}</span>`,
        clientLink(s.userId)
      )
    )
  );

  const stuck = section(
    "⏳ Provisioning bloqué (> 15 min)",
    stuckProvisioning.map((s) =>
      row(
        `<strong>${esc(s.name)}</strong> <span style="color:#888">· ${esc(s.email)}</span>`,
        clientLink(s.userId)
      )
    )
  );

  const churn = section(
    "💔 Clients à risque",
    clientsAtRisk.map((c) =>
      row(
        `<strong>${esc(c.email)}</strong> <span style="color:#888">· ${esc(HEALTH_FR[c.status] ?? c.status)} — ${esc(c.reason)}</span>`,
        clientLink(c.userId)
      )
    )
  );

  const signups = section(
    "🙌 Nouveaux inscrits (24 h)",
    newSignups.map((u) =>
      row(`${esc(u.email)} <span style="color:#888">· ${esc(u.plan)}</span>`, fmtDate(u.createdAt))
    )
  );

  const body =
    actionable === 0 && newSignups.length === 0
      ? `<p style="color:#444">Aucune relance en retard, aucun serveur en erreur, aucun nouveau lead, aucun client à risque. Profitez-en 🙂</p>`
      : relances + leads + errors + stuck + churn + signups;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <p style="font-size:16px;margin:0 0 4px"><strong>Votre point du jour</strong></p>
    <p style="color:#666;margin:0 0 8px;font-size:13px">${actionable} action${actionable > 1 ? "s" : ""} · relances ${counts.followUpsDue} · leads ${counts.newLeads} · serveurs KO ${counts.serversInError} · à risque ${counts.clientsAtRisk}</p>
    ${body}
    <p style="margin:28px 0 0"><a href="${SITE}/dashboard/admin/cockpit" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Ouvrir le cockpit</a></p>
    <p style="color:#999;font-size:12px;margin-top:24px">TwinMCP · digest quotidien</p>
  </div>`;

  return { subject, html };
}
