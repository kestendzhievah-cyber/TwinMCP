// WhatsApp Business Cloud API (Meta) — sends a pre-approved template message.
//
// Cold outreach on WhatsApp is ONLY possible via an approved "template" message
// (free-form text is limited to the 24h window after the recipient writes you).
// So the first-contact prospection message is a template with two body vars:
//   {{1}} = greeting/name, {{2}} = company.
//
// Required env (Dokploy):
//   WHATSAPP_PHONE_NUMBER_ID   — the Cloud API phone number id (Meta dashboard)
//   WHATSAPP_ACCESS_TOKEN      — a permanent system-user token with whatsapp perms
// Optional:
//   WHATSAPP_TEMPLATE_NAME     — default "prospection_intro"
//   WHATSAPP_TEMPLATE_LANG     — default "fr"
//   WHATSAPP_API_VERSION       — default "v21.0"

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export function isWhatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

// Normalise to the digits-only international form the Cloud API expects (no "+").
// Convenience for French numbers: a 10-digit local number starting with 0 is
// promoted to the 33 country code.
export function normalizePhone(raw: string): string | null {
  let d = (raw ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.length === 10 && d.startsWith("0")) d = "33" + d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export interface WhatsappSendResult {
  id: string;
  to: string;
}

export async function sendProspectingTemplate(opts: {
  phone: string;
  contactName?: string | null;
  company: string;
}): Promise<WhatsappSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) throw new Error("WhatsApp non configuré");

  const to = normalizePhone(opts.phone);
  if (!to) throw new Error("Numéro de téléphone invalide");

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "prospection_intro";
  const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "fr";
  // {{1}} is never empty (Meta rejects blank params); falls back to a neutral
  // greeting when we only have a phone number.
  const name = opts.contactName?.trim() || "à vous";

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: opts.company },
            ],
          },
        ],
      },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    messages?: { id?: string }[];
  };
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Erreur API WhatsApp (${res.status})`);
  }
  return { id: json?.messages?.[0]?.id ?? "", to };
}
