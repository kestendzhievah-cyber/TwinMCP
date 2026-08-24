import type { AuthError } from "@supabase/supabase-js";

const MAP: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email address before signing in.",
  user_not_found: "No account exists for this email address.",
  user_already_exists: "An account already exists for this email. Try signing in.",
  weak_password:
    "This password is too weak. Use at least 8 characters, a number, and a capital letter.",
  over_email_send_rate_limit:
    "Too many emails sent to this address recently. Try again in a few minutes.",
  over_request_rate_limit: "Too many attempts. Wait a moment before trying again.",
  signup_disabled: "Sign-ups are temporarily disabled.",
  email_address_invalid: "This email address isn't valid.",
  same_password: "Choose a password different from your previous one.",
  session_not_found: "Your session has expired. Please sign in again.",
  otp_expired: "This link has expired or was already used. Request a new one.",
  access_denied: "Sign-in was cancelled.",
  auth_failed: "We couldn't complete sign-in. Please try again.",
};

const MESSAGE_FALLBACKS: Array<[RegExp, string]> = [
  [/invalid login/i, MAP.invalid_credentials],
  [/email not confirmed/i, MAP.email_not_confirmed],
  [/user not found/i, MAP.user_not_found],
  [/already registered|already exists/i, MAP.user_already_exists],
  [/rate ?limit/i, MAP.over_request_rate_limit],
  [/weak password|password.*short/i, MAP.weak_password],
];

export function friendlyAuthError(err: AuthError | { message: string; code?: string } | null) {
  if (!err) return "";
  const code = "code" in err ? err.code : undefined;
  if (code && MAP[code]) return MAP[code];
  for (const [re, msg] of MESSAGE_FALLBACKS) if (re.test(err.message)) return msg;
  return err.message || "Something went wrong. Please try again.";
}
