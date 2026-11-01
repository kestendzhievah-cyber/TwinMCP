// Transactional email chrome in the "Clear sky" design system (docs/DESIGN.md):
// a white card on the light-blue page, navy ink, sentence case, one rose
// button, a quiet address line. Inline styles only (email clients ignore
// stylesheets) and no web fonts: Inter where the reader has it, then the
// platform sans. Hex constants mirror the light tokens in globals.css (the
// design-tokens guard exempts this file: no class names here).

const PAGE = "#F3F8FF"; // --background
const CARD = "#FFFFFF"; // --card
const INK = "#0B1F3A"; // --foreground
const MUTED = "#3D5272"; // --muted-foreground
const RULE = "#D2DEEE"; // --border
const BRAND = "#1E4FC2"; // --brand: links and the eyebrow
const PRIMARY = "#C2255C"; // --primary: the one button
const ON_PRIMARY = "#FFFFFF"; // --primary-foreground

const SANS = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

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
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${html}</p>`;
}

/** An inline link in brand blue. */
export function link(href: string, label: string): string {
  return `<a href="${href}" style="color:${BRAND};text-decoration:underline">${label}</a>`;
}

/** A definition row: a muted label, the value in the reading colour. */
export function row(label: string, valueHtml: string): string {
  return (
    `<tr>` +
    `<td style="padding:10px 24px 10px 0;border-bottom:1px solid ${RULE};font-size:13px;font-weight:600;color:${MUTED};vertical-align:top;white-space:nowrap">${label}</td>` +
    `<td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:15px;line-height:1.5;color:${INK}">${valueHtml}</td>` +
    `</tr>`
  );
}

export function table(rows: string[]): string {
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;font-family:${SANS}">${rows.join("")}</table>`;
}

export interface CardEmail {
  /** Short eyebrow above the title (small brand-blue capitals), e.g. "Account". */
  eyebrow?: string;
  title: string;
  /** Body HTML (compose with p(), link(), table()). */
  body: string;
  cta?: { label: string; href: string };
  /**
   * One quiet line under the address footer (compose with esc()/link()), e.g.
   * why the recipient gets this email and where to manage preferences.
   */
  footerNote?: string;
}

// The TwinMCP mark as text (spec §4.13): a navy rounded square holding a white
// "T", then the wordmark. Email clients block SVG and often images, so it is
// drawn with a table cell; the rose dot is left out (no reliable positioning).
const BRAND_HEADER =
  `<table role="presentation" style="border-collapse:collapse;margin:0 0 28px"><tr>` +
  `<td style="width:28px;height:28px;background:${INK};border-radius:10px;color:${CARD};font-family:${SANS};font-size:14px;font-weight:800;line-height:28px;text-align:center">T</td>` +
  `<td style="padding-left:10px;font-family:${SANS};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${INK}">TwinMCP</td>` +
  `</tr></table>`;

/** Wraps content in the card chrome and returns the full HTML body. */
export function cardEmail({ eyebrow, title, body, cta, footerNote }: CardEmail): string {
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${cta.href}" style="display:inline-block;background:${PRIMARY};border:1px solid ${PRIMARY};border-radius:10px;color:${ON_PRIMARY};text-decoration:none;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1.2">${esc(cta.label)}</a></p>`
    : "";
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND}">${esc(eyebrow)}</p>`
    : "";
  const footerNoteHtml = footerNote
    ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">${footerNote}</p>`
    : "";
  return `<div style="background:${PAGE};padding:32px 16px;font-family:${SANS};color:${INK}">
  <div style="max-width:560px;margin:0 auto;background:${CARD};border:1px solid ${RULE};border-radius:16px;padding:36px 32px 28px">
    ${BRAND_HEADER}
    ${eyebrowHtml}
    <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${INK}">${esc(title)}</h1>
    ${body}
    ${button}
    <hr style="border:0;border-top:1px solid ${RULE};margin:32px 0 16px">
    <p style="margin:0;font-size:12px;color:${MUTED};text-align:center">twinmcp.fr &middot; hello@twinmcp.fr</p>
    ${footerNoteHtml}
  </div>
</div>`;
}
