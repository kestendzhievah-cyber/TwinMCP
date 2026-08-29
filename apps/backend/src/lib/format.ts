// Deterministic date formatting. Fixed locale + UTC timezone so the string is
// identical whether it's produced on the server (Node, en-US/UTC) or in the
// browser (any locale/timezone) — this avoids React hydration mismatches when a
// client component renders a date during SSR. "en-GB" gives an unambiguous
// "15 Aug 2026" ordering.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(value: Date | string | number): string {
  return DATE.format(new Date(value));
}

export function formatDateTime(value: Date | string | number): string {
  return DATE_TIME.format(new Date(value));
}
