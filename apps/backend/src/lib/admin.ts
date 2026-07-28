// Admin allowlist. An email is an admin if it appears in ADMIN_EMAILS
// (comma-separated, case-insensitive). If ADMIN_EMAILS is unset we fall back to
// the founder's email so the admin analytics dashboard works out of the box —
// override it in production by setting ADMIN_EMAILS in Dokploy.
//
// This is the SINGLE source of truth for "who can see platform-wide stats".
// It's enforced server-side on both the /dashboard/admin page and the
// /api/v2/admin/* API — never trust the hidden nav link alone.

const DEFAULT_ADMIN_EMAILS = ["kestendzhievah@gmail.com"];

/** The current admin allowlist, lowercased + trimmed. */
export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // An explicit ADMIN_EMAILS fully replaces the default (so you can restrict or
  // hand off admin access without touching code).
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
