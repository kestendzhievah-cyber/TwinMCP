// CSV helpers for admin exports (opened in Excel / imported into emailing tools).

/**
 * One CSV cell: quoted when it contains a separator, quote or newline, and
 * neutralized when it starts with a formula character (=, +, -, @, tab, CR) so
 * a crafted name or email can't run as a formula in a spreadsheet.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header + rows → CSV text with a UTF-8 BOM (so Excel reads accents correctly). */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
