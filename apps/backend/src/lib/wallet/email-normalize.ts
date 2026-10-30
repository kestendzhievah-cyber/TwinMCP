import { createHmac } from "node:crypto";

// Canonical form of an email address for "one sign-up credit per person"
// (contract W4). Server-only (node:crypto).
//
// The canonical form folds the cheap aliases a farmer would use to claim the
// €10 credit twice with one inbox:
//   - case:            Jane@Example.com        → jane@example.com
//   - +tags (all):     jane+promo2@example.com → jane@example.com
//   - Gmail dots:      j.a.n.e@gmail.com       → jane@gmail.com
//   - Googlemail:      jane@googlemail.com     → jane@gmail.com
// It is ONLY used to deduplicate the credit claim (hashed below). The address
// the user signs in with, and the one we email, are never rewritten.

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Lowercased domain part of an address, or "" when there is no "@". */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
}

/**
 * Canonical address: NFKC, trimmed, lowercased, "+tag" removed for every
 * domain, dots removed and googlemail.com folded into gmail.com for Gmail.
 * Input without a usable local part and domain is returned trimmed and
 * lowercased (the caller rejects it as unverified).
 */
export function normalizeEmail(raw: string): string {
  const email = raw.normalize("NFKC").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return email;

  let local = email.slice(0, at);
  let domain = emailDomain(email);

  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);

  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }

  // "+anything" alone (or ".") leaves nothing: keep the original local part so
  // two such addresses do not collapse into one bogus "@domain" key.
  if (!local) return email;
  return `${local}@${domain}`;
}

let warnedNoPepper = false;

/**
 * Server secret mixed into the hash so the claims table cannot be reversed
 * with a dictionary of addresses. SIGNUP_HASH_PEPPER, else CONFIG_ENCRYPTION_KEY.
 * Set SIGNUP_HASH_PEPPER explicitly in production and never rotate it:
 * a new pepper makes every past claim unrecognisable (one more €10 per user).
 */
export function signupHashPepper(): string {
  const pepper = process.env.SIGNUP_HASH_PEPPER || process.env.CONFIG_ENCRYPTION_KEY;
  if (pepper) return pepper;
  if (!warnedNoPepper) {
    warnedNoPepper = true;
    console.warn(
      "[signup-credit] SIGNUP_HASH_PEPPER and CONFIG_ENCRYPTION_KEY are unset: hashing emails with a fixed development pepper"
    );
  }
  return "twinmcp-signup-credit-dev-pepper";
}

/** HMAC-SHA256 (hex) of the canonical address under the server pepper. */
export function hashEmail(email: string, pepper: string = signupHashPepper()): string {
  return createHmac("sha256", pepper).update(normalizeEmail(email)).digest("hex");
}
