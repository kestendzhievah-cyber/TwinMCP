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
    `<tr><td style="padding:6px 0;border-bottom:1px solid #d8d1c3">${left}</td>` +
    `<td style="padding:6px 0;border-bottom:1px solid #d8d1c3;text-align:right;color:#665f55;white-space:nowrap">${right}</td></tr>`;

  const section = (title: string, rows: string[]): string =>
    rows.length === 0
      ? ""
      : `<h2 style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;margin:28px 0 8px;color:#2b2825">${esc(title)}</h2>` +
        `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows.join("")}</table>`;

  const clientLink = (userId: string) =>
    `<a href="${SITE}/dashboard/admin/clients/${userId}" style="color:#233048">voir</a>`;

  const relances = section(
    "🔔 Relances du jour",
    followUpsDue.map((p) =>
      row(
        `<strong>${esc(p.company)}</strong>${p.contactName ? " · " + esc(p.contactName) : ""}` +
          (p.email || p.phone
            ? `<br><span style="color:#665f55;font-size:12px">${esc([p.email, p.phone].filter(Boolean).join(" · "))}</span>`
            : ""),
        fmtDate(p.nextActionAt)
      )
    )
  );

  const leads = section(
    "✨ Nouveaux leads (24 h)",
    newLeads.map((p) =>
      row(
        `<strong>${esc(p.company)}</strong>${p.source ? ` <span style="color:#665f55">· ${esc(p.source)}</span>` : ""}`,
        fmtDate(p.createdAt)
      )
    )
  );

  const errors = section(
    "⚠️ Serveurs en erreur",
    serversInError.map((s) =>
      row(
        `<strong>${esc(s.name)}</strong> <span style="color:#665f55">· ${esc(s.email)}</span>`,
        clientLink(s.userId)
      )
    )
  );

  const stuck = section(
    "⏳ Provisioning bloqué (> 15 min)",
    stuckProvisioning.map((s) =>
      row(
        `<strong>${esc(s.name)}</strong> <span style="color:#665f55">· ${esc(s.email)}</span>`,
        clientLink(s.userId)
      )
    )
  );

  const churn = section(
    "💔 Clients à risque",
    clientsAtRisk.map((c) =>
      row(
        `<strong>${esc(c.email)}</strong> <span style="color:#665f55">· ${esc(HEALTH_FR[c.status] ?? c.status)} — ${esc(c.reason)}</span>`,
        clientLink(c.userId)
      )
    )
  );

  const signups = section(
    "🙌 Nouveaux inscrits (24 h)",
    newSignups.map((u) =>
      row(
        `${esc(u.email)} <span style="color:#665f55">· ${esc(u.plan)}</span>`,
        fmtDate(u.createdAt)
      )
    )
  );

  const body =
    actionable === 0 && newSignups.length === 0
      ? `<p style="color:#2b2825;font-size:16px;line-height:1.6">Aucune relance en retard, aucun serveur en erreur, aucun nouveau lead, aucun client à risque. Profitez-en 🙂</p>`
      : relances + leads + errors + stuck + churn + signups;

  const html = `<div style="background:#f4f0e8;padding:24px 12px;font-family:Garamond,'EB Garamond',Georgia,'Times New Roman',serif;color:#2b2825"><div style="max-width:600px;margin:0 auto;background:#f9f6ef;border:1px solid #d8d1c3;padding:32px">
    <p style="margin:0 0 16px;font-size:13px;letter-spacing:0.24em;text-transform:uppercase;color:#2b2825;border-bottom:3px double #d8d1c3;padding-bottom:14px">TwinMCP &middot; <span style="color:#665f55">Cockpit</span></p>
    <p style="font-size:24px;font-weight:500;margin:0 0 6px">Votre point du jour</p>
    <p style="color:#665f55;margin:0 0 8px;font-size:14px;font-style:italic">${actionable} action${actionable > 1 ? "s" : ""} · relances ${counts.followUpsDue} · leads ${counts.newLeads} · serveurs KO ${counts.serversInError} · à risque ${counts.clientsAtRisk}</p>
    ${body}
    <p style="margin:28px 0 0"><a href="${SITE}/dashboard/admin/cockpit" style="display:inline-block;background:#2b2825;color:#f4f0e8;text-decoration:none;padding:12px 22px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase">Ouvrir le cockpit</a></p>
    <p style="color:#665f55;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-top:28px;border-top:1px solid #d8d1c3;padding-top:14px;text-align:center">TwinMCP &middot; digest quotidien &middot; twinmcp.fr</p>
  </div></div>`;

  return { subject, html };
}
