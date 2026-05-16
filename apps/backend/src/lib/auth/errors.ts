import type { AuthError } from "@supabase/supabase-js";

const MAP: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  email_not_confirmed: "Confirme ton adresse email avant de te connecter.",
  user_not_found: "Aucun compte n'existe avec cette adresse email.",
  user_already_exists: "Un compte existe déjà pour cette adresse. Essaie de te connecter.",
  weak_password: "Ce mot de passe est trop faible. Utilise au moins 8 caractères, un chiffre et une majuscule.",
  over_email_send_rate_limit:
    "Trop d'emails envoyés à cette adresse récemment. Réessaie dans quelques minutes.",
  over_request_rate_limit: "Trop de tentatives. Patiente un instant avant de réessayer.",
  signup_disabled: "Les inscriptions sont temporairement désactivées.",
  email_address_invalid: "Cette adresse email n'est pas valide.",
  same_password: "Choisis un mot de passe différent de l'ancien.",
  session_not_found: "Ta session a expiré. Reconnecte-toi.",
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
  return err.message || "Une erreur est survenue. Réessaie.";
}
