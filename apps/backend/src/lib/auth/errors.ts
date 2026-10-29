import type { AuthError } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/locales";

const MAP: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email address before signing in.",
  user_not_found: "No account exists for this email address.",
  user_already_exists: "An account already exists for this email. Try signing in.",
  // The sign-up rule (app/(auth)/sign-up/form.tsx passwordAccepted): 8+
  // characters and two of mixed case, a number, a symbol.
  weak_password:
    "This password is too weak. Use at least 8 characters with two of: upper- and lowercase letters, a number, a symbol.",
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
  // PKCE: the link was opened in another browser than the one that asked for
  // it (the code verifier lives in that browser), or the flow timed out.
  bad_code_verifier:
    "This link was opened in a different browser from the one you requested it in. Sign in here, or request a new link from this browser.",
  flow_state_not_found:
    "This link was opened in a different browser from the one you requested it in. Sign in here, or request a new link from this browser.",
  flow_state_expired: "This link has expired. Request a new one.",
};

// French twin of MAP (same codes), in "vous" like the French marketing pages.
const MAP_FR: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed: "Confirmez votre adresse e-mail avant de vous connecter.",
  user_not_found: "Aucun compte n'existe pour cette adresse e-mail.",
  user_already_exists:
    "Un compte existe déjà pour cette adresse e-mail. Essayez de vous connecter.",
  weak_password:
    "Ce mot de passe est trop faible. Utilisez au moins 8 caractères avec deux éléments parmi : majuscules et minuscules, un chiffre, un symbole.",
  over_email_send_rate_limit:
    "Trop d'e-mails ont été envoyés à cette adresse récemment. Réessayez dans quelques minutes.",
  over_request_rate_limit: "Trop de tentatives. Patientez un instant avant de réessayer.",
  signup_disabled: "Les inscriptions sont temporairement désactivées.",
  email_address_invalid: "Cette adresse e-mail n'est pas valide.",
  same_password: "Choisissez un mot de passe différent de l'ancien.",
  session_not_found: "Votre session a expiré. Reconnectez-vous.",
  otp_expired: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  access_denied: "La connexion a été annulée.",
  auth_failed: "Nous n'avons pas pu finaliser la connexion. Réessayez.",
  bad_code_verifier:
    "Ce lien a été ouvert dans un autre navigateur que celui où vous l'avez demandé. Connectez-vous ici, ou demandez un nouveau lien depuis ce navigateur.",
  flow_state_not_found:
    "Ce lien a été ouvert dans un autre navigateur que celui où vous l'avez demandé. Connectez-vous ici, ou demandez un nouveau lien depuis ce navigateur.",
  flow_state_expired: "Ce lien a expiré. Demandez-en un nouveau.",
};

const MESSAGES: Record<Locale, Record<string, string>> = { en: MAP, fr: MAP_FR };

// Raw Supabase messages (no `code`) → the MAP key they mean.
const MESSAGE_FALLBACKS: Array<[RegExp, string]> = [
  [/invalid login/i, "invalid_credentials"],
  [/email not confirmed/i, "email_not_confirmed"],
  [/user not found/i, "user_not_found"],
  [/already registered|already exists/i, "user_already_exists"],
  [/rate ?limit/i, "over_request_rate_limit"],
  [/weak password|password.*short/i, "weak_password"],
];

// French only: the English default deliberately passes these raw messages
// through unchanged, but a French visitor should never read them in English.
const FR_EXTRA_FALLBACKS: Array<[RegExp, string]> = [
  [/validate email|invalid format|email address .* is invalid/i, "email_address_invalid"],
];

export function friendlyAuthError(
  err: AuthError | { message: string; code?: string } | null,
  locale: Locale = "en"
) {
  if (!err) return "";
  const messages = MESSAGES[locale];
  const code = "code" in err ? err.code : undefined;
  if (code && messages[code]) return messages[code];
  for (const [re, key] of MESSAGE_FALLBACKS) if (re.test(err.message)) return messages[key];
  if (locale === "fr") {
    for (const [re, key] of FR_EXTRA_FALLBACKS) if (re.test(err.message)) return messages[key];
    // Unknown error: say it in French, keep the raw message for support.
    return err.message
      ? `Une erreur est survenue (${err.message}). Réessayez.`
      : "Une erreur est survenue. Réessayez.";
  }
  return err.message || "Something went wrong. Please try again.";
}
