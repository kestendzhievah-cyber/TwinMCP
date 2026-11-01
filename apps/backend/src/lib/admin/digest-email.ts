import type { AttentionData } from "./attention";

// Builds the daily digest email (subject + HTML) from the shared attention data.
// Plain inline-styled HTML — email clients don't do external CSS. Same
// "Clear sky" chrome as lib/email-layout.ts (docs/DESIGN.md): white card on the
// light-blue page, navy ink, sentence case, one rose button. Hex constants
// mirror the light tokens (the design-tokens guard exempts this file).

const PAGE = "#F3F8FF";
const CARD = "#FFFFFF";
const INK = "#0B1F3A";
const MUTED = "#3D5272";
const RULE = "#D2DEEE";
const BRAND = "#1E4FC2";
const PRIMARY = "#C2255C";
const SANS = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

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
    `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid ${RULE};color:${INK}">${left}</td>` +
    `<td style="padding:8px 0;border-bottom:1px solid ${RULE};text-align:right;color:${MUTED};white-space:nowrap">${right}</td></tr>`;

  const section = (title: string, rows: string[]): string =>
    rows.length === 0
      ? ""
      : `<h2 style="font-size:16px;line-height:1.3;font-weight:700;margin:28px 0 8px;color:${INK}">${esc(title)}</h2>` +
        `<table role="presentation" style="width:100%;border-collapse:collapse;font-family:${SANS};font-size:14px;line-height:1.5">${rows.join("")}</table>`;

  const clientLink = (userId: string) =>
    `<a href="${SITE}/dashboard/admin/clients/${userId}" style="color:${BRAND};text-decoration:underline">voir</a>`;

  const relances = section(
    "🔔 Relances du jour",
    followUpsDue.map((p) =>
      row(
        `<strong>${esc(p.company)}</strong>${p.contactName ? " · " + esc(p.contactName) : ""}` +
          (p.email || p.phone
            ? `<br><span style="color:${MUTED};font-size:12px">${esc([p.email, p.phone].filter(Boolean).join(" · "))}</span>`
            : ""),
        fmtDate(p.nextActionAt)
      )
    )
  );

  const leads = section(
    "✨ Nouveaux leads (24 h)",
    newLeads.map((p) =>
      row(
        `<strong>${esc(p.company)}</strong>${p.source ? ` <span style="color:${MUTED}">· ${esc(p.source)}</span>` : ""}`,
        fmtDate(p.createdAt)
      )
    )
  );

  const errors = section(
    "⚠️ Serveurs en erreur",
    serversInError.map((s) =>
      row(
        `<strong>${esc(s.name)}</strong> <span style="color:${MUTED}">· ${esc(s.email)}</span>`,
        clientLink(s.userId)
      )
    )
  );

  const stuck = section(
    "⏳ Provisioning bloqué (> 15 min)",
    stuckProvisioning.map((s) =>
      row(
        `<strong>${esc(s.name)}</strong> <span style="color:${MUTED}">· ${esc(s.email)}</span>`,
        clientLink(s.userId)
      )
    )
  );

  const churn = section(
    "💔 Clients à risque",
    clientsAtRisk.map((c) =>
      row(
        `<strong>${esc(c.email)}</strong> <span style="color:${MUTED}">· ${esc(HEALTH_FR[c.status] ?? c.status)} — ${esc(c.reason)}</span>`,
        clientLink(c.userId)
      )
    )
  );

  const signups = section(
    "🙌 Nouveaux inscrits (24 h)",
    newSignups.map((u) =>
      row(
        `${esc(u.email)} <span style="color:${MUTED}">· ${esc(u.plan)}</span>`,
        fmtDate(u.createdAt)
      )
    )
  );

  const body =
    actionable === 0 && newSignups.length === 0
      ? `<p style="margin:16px 0 0;color:${INK};font-size:16px;line-height:1.6">Aucune relance en retard, aucun serveur en erreur, aucun nouveau lead, aucun client à risque. Profitez-en 🙂</p>`
      : relances + leads + errors + stuck + churn + signups;

  const html = `<div style="background:${PAGE};padding:24px 12px;font-family:${SANS};color:${INK}"><div style="max-width:600px;margin:0 auto;background:${CARD};border:1px solid ${RULE};border-radius:16px;padding:32px 28px">
    <table role="presentation" style="border-collapse:collapse;margin:0 0 24px"><tr><td style="width:28px;height:28px;background:${INK};border-radius:10px;color:${CARD};font-family:${SANS};font-size:14px;font-weight:800;line-height:28px;text-align:center">T</td><td style="padding-left:10px;font-family:${SANS};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${INK}">TwinMCP <span style="font-weight:600;color:${MUTED}">&middot; Cockpit</span></td></tr></table>
    <p style="margin:0 0 6px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${INK}">Votre point du jour</p>
    <p style="margin:0 0 8px;font-size:14px;color:${MUTED}">${actionable} action${actionable > 1 ? "s" : ""} · relances ${counts.followUpsDue} · leads ${counts.newLeads} · serveurs KO ${counts.serversInError} · à risque ${counts.clientsAtRisk}</p>
    ${body}
    <p style="margin:28px 0 0"><a href="${SITE}/dashboard/admin/cockpit" style="display:inline-block;background:${PRIMARY};border:1px solid ${PRIMARY};border-radius:10px;color:#FFFFFF;text-decoration:none;padding:12px 22px;font-size:15px;font-weight:600;line-height:1.2">Ouvrir le cockpit</a></p>
    <p style="margin:28px 0 0;border-top:1px solid ${RULE};padding-top:14px;font-size:12px;color:${MUTED};text-align:center">TwinMCP &middot; digest quotidien &middot; twinmcp.fr</p>
  </div></div>`;

  return { subject, html };
}
