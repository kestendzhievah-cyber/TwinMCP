// Transactional email chrome in the design system's voice (docs/DESIGN.md):
// the message is a bone business card — serif, hairline frame, letterspaced
// capitals, one ink button, an address line. Inline styles only (email
// clients ignore stylesheets); no web fonts (Garamond falls back to Georgia).

const BONE = "#f4f0e8";
const CARD = "#f9f6ef";
const INK = "#2b2825";
const MUTED = "#665f55";
const RULE = "#d8d1c3";
const NAVY = "#233048";

const SERIF = "Garamond, 'EB Garamond', Georgia, 'Times New Roman', serif";

const CAPS = "letter-spacing:0.18em;text-transform:uppercase;";

/** Minimal HTML escape so dynamic values can't inject markup into the email. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A paragraph in the reading size. `html` must already be escaped. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-size:17px;line-height:1.6;color:${INK}">${html}</p>`;
}

/** An inline link in pinstripe navy. */
export function link(href: string, label: string): string {
  return `<a href="${href}" style="color:${NAVY};text-decoration:underline">${label}</a>`;
}

/** A definition row: label in small capitals, value in the reading size. */
export function row(label: string, valueHtml: string): string {
  return (
    `<tr>` +
    `<td style="padding:8px 24px 8px 0;border-bottom:1px solid ${RULE};font-size:12px;${CAPS}color:${MUTED};vertical-align:top;white-space:nowrap">${label}</td>` +
    `<td style="padding:8px 0;border-bottom:1px solid ${RULE};font-size:16px;color:${INK}">${valueHtml}</td>` +
    `</tr>`
  );
}

export function table(rows: string[]): string {
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;font-family:${SERIF}">${rows.join("")}</table>`;
}

export interface CardEmail {
  /** Short eyebrow above the title (letterspaced capitals), e.g. "Account". */
  eyebrow?: string;
  title: string;
  /** Body HTML (compose with p(), link(), table()). */
  body: string;
  cta?: { label: string; href: string };
}

/** Wraps content in the card chrome and returns the full HTML body. */
export function cardEmail({ eyebrow, title, body, cta }: CardEmail): string {
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${cta.href}" style="display:inline-block;background:${INK};color:${BONE};text-decoration:none;padding:12px 22px;font-size:12px;${CAPS}font-family:${SERIF}">${esc(cta.label)}</a></p>`
    : "";
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 8px;font-size:11px;${CAPS}color:${MUTED}">${esc(eyebrow)}</p>`
    : "";
  return `<div style="background:${BONE};padding:32px 16px;font-family:${SERIF};color:${INK}">
  <div style="max-width:560px;margin:0 auto;background:${CARD};border:1px solid ${RULE};padding:40px 40px 32px">
    <p style="margin:0;font-size:14px;letter-spacing:0.24em;text-transform:uppercase;color:${INK}">TwinMCP</p>
    <p style="margin:4px 0 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${MUTED}">Managed MCP Runtimes</p>
    <hr style="border:0;border-top:3px double ${RULE};margin:24px 0">
    ${eyebrowHtml}
    <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;font-weight:500;color:${INK}">${esc(title)}</h1>
    ${body}
    ${button}
    <hr style="border:0;border-top:1px solid ${RULE};margin:32px 0 16px">
    <p style="margin:0;font-size:11px;${CAPS}color:${MUTED};text-align:center">twinmcp.fr &middot; hello@twinmcp.fr</p>
  </div>
</div>`;
}
